import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';
import { MAX_CLIENT_TURNS } from './cases';
import { ISSUE_TYPES, buildActionPlan, type IssueType } from './lib/actionPlan';
import { FACT_SCHEMA_PROMPT, describeFacts, missingFacts, sanitiseFacts, type Facts } from './lib/facts';
import { FAST_MODEL, SMART_MODEL, TONE, clientText, geminiJson, obj, str, strArr } from './lib/gemini';
import { RULESET_VERSION, SCHEME_INFO, runAllSchemes, type SchemeResult } from './lib/schemes';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ur: 'Urdu',
  pl: 'Polish',
  ar: 'Arabic',
  ro: 'Romanian',
  ku: 'Kurdish (Sorani)',
  pa: 'Punjabi',
};

const SAFEGUARDING_RULE = `"safeguarding": a string ONLY if there is any sign of domestic abuse, a child at risk, self-harm, suicidal thoughts or immediate danger; one kind sentence telling them to call 999 in an emergency, and the National Domestic Abuse Helpline 0808 2000 247 or Samaritans 116 123 as fits. Otherwise null.`;

type TurnResult = { done: boolean; aiFailed: boolean };

/**
 * One turn of the conversational intake. Extracts facts from what the client
 * said, then asks for the next thing the rules still need.
 */
export const turn = action({
  args: { token: v.string(), caseId: v.id('cases'), text: v.optional(v.string()) },
  handler: async (ctx, { token, caseId, text }): Promise<TurnResult> => {
    const { case: c, language } = await ctx.runQuery(internal.cases.loadForClient, { token, caseId });
    if (c.status !== 'draft') throw new ConvexError('This case has already been sent to an adviser.');

    const said = (text ?? '').trim().slice(0, 2000);
    const clientTurns = c.transcript.filter((t) => t.role === 'client').length + (said ? 1 : 0);
    const lastQuestion = c.nextQuestion;
    const langName = LANGUAGE_NAMES[language] ?? 'English';

    let extracted: Facts = {};
    let confidence: Record<string, number> = {};
    let safeguarding: string | undefined;
    let phrased: { text?: string; suggestions: string[] } | undefined;
    let meta: unknown = { ai: false };
    let aiFailed = false;

    if (said) {
      // Ask the model to extract, then also phrase the next question for what will still be missing.
      try {
        const { data, meta: m } = await geminiJson({
          model: FAST_MODEL,
          timeoutMs: 15000,
          system: TONE,
          prompt: `Extract facts about a person's situation from their latest message.

Today is ${new Date().toISOString().slice(0, 10)}.
Facts we already have:
${describeFacts(c.facts)}
${lastQuestion ? `The question they are answering: "${lastQuestion.text}" (field: ${lastQuestion.key})` : 'This is their first message describing what has happened.'}

Their message:
${clientText(said)}

Return JSON:
{
 "facts": object with ONLY the fields you can actually tell from the message, using this schema: ${FACT_SCHEMA_PROMPT},
 "confidence": object mapping each field you returned to a number 0..1,
 ${SAFEGUARDING_RULE},
 "ack": string, under 12 words, in ${langName}, a warm acknowledgement of what they said (no question)
}
Rules: convert amounts to pence (e.g. "£40" -> 4000, "nothing" -> 0). "Just me" means adults 1. A sanction or cut means reasons includes "benefit_change" and benefitDecisionType "sanction". A meter "on emergency credit" or "run out" means hasPrepaymentMeter true, meterCreditPence 0 and energy "cant_top_up". If they say they are not sure, omit the field. Relative dates like "last Tuesday" become YYYY-MM-DD using today's date.`,
          parse: (raw) => {
            const o = obj(raw);
            const facts = sanitiseFacts(o.facts && typeof o.facts === 'object' ? (o.facts as Record<string, unknown>) : {});
            const conf: Record<string, number> = {};
            if (o.confidence && typeof o.confidence === 'object') {
              for (const [k, val] of Object.entries(o.confidence as Record<string, unknown>)) {
                if (typeof val === 'number' && k in facts) conf[k] = Math.max(0, Math.min(1, val));
              }
            }
            return { facts, conf, safeguarding: str(o.safeguarding, 400), ack: str(o.ack, 120) };
          },
        });
        extracted = data.facts;
        confidence = data.conf;
        safeguarding = data.safeguarding;
        phrased = { text: data.ack, suggestions: [] };
        meta = m;
      } catch (err) {
        console.warn('intake extraction failed', err);
        aiFailed = true;
      }
    }

    // Work out what is still missing after this message (rules, not AI).
    const merged = sanitiseFacts({ ...c.facts, ...Object.fromEntries(Object.entries(extracted).filter(([k]) => (confidence[k] ?? 1) >= 0.6)) });
    const missing = missingFacts(merged);
    const done = missing.length === 0 || clientTurns >= MAX_CLIENT_TURNS;
    const next = done ? undefined : missing[0];

    let nextQuestion: { key: string; text: string; suggestions: string[] } | undefined;
    if (next) {
      nextQuestion = { key: next.key, text: next.question, suggestions: next.suggestions };
      if (language !== 'en') {
        // Translate the fixed question for non-English speakers.
        try {
          const { data } = await geminiJson({
            model: FAST_MODEL,
            timeoutMs: 10000,
            system: TONE,
            prompt: `Translate into ${langName}. Keep it short and friendly. Return JSON {"text": string, "suggestions": string[]}.
${JSON.stringify({ text: next.question, suggestions: next.suggestions })}`,
            parse: (raw) => {
              const o = obj(raw);
              return { text: str(o.text, 200), suggestions: strArr(o.suggestions, 4, 60) };
            },
          });
          if (data.text) nextQuestion = { key: next.key, text: data.text, suggestions: data.suggestions.length ? data.suggestions : next.suggestions };
        } catch {
          // Fall back to English.
        }
      }
    }

    const assistantText = [phrased?.text, nextQuestion?.text].filter(Boolean).join(' ') || undefined;

    await ctx.runMutation(internal.cases.applyIntake, {
      caseId,
      clientText: said || undefined,
      facts: extracted,
      confidence,
      assistantText: done ? (phrased?.text ? `${phrased.text} I have what I need.` : 'Thanks, I have what I need.') : assistantText,
      nextQuestion,
      safeguarding,
      done,
      meta,
    });
    return { done, aiFailed };
  },
});

/**
 * Runs the rules, then has the AI explain them, triage the root cause and
 * write the adviser summary. The rules decide; the AI explains.
 */
export const assess = action({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }): Promise<null> => {
    const { case: c, language } = await ctx.runQuery(internal.cases.loadForClient, { token, caseId });
    if (c.status !== 'draft') throw new ConvexError('This case has already been sent to an adviser.');

    const results: SchemeResult[] = runAllSchemes(c.facts);
    const langName = LANGUAGE_NAMES[language] ?? 'English';
    const clientWords = [c.story, ...c.transcript.filter((t) => t.role === 'client').map((t) => t.text)].filter(Boolean).join('\n');

    type Ai = {
      clientSummary?: string;
      adviserSummary?: string;
      caseNote?: string;
      issues: IssueType[];
      flags: string[];
      safeguarding?: string;
      schemes: Record<string, { explanation?: string; toFinish: string[] }>;
    };
    let ai: Ai | null = null;
    let meta: unknown = { ai: false };
    try {
      const out = await geminiJson<Ai>({
        model: SMART_MODEL,
        system: TONE,
        prompt: `A person in Leeds has asked for help. The RULES below have already decided the pre-check outcomes. Do not change or contradict them; explain them.

FACTS
${describeFacts(c.facts)}

THEIR OWN WORDS
${clientText(clientWords || '(none)')}

RULE RESULTS
${results
  .map(
    (r) =>
      `${SCHEME_INFO[r.scheme].name} [${r.scheme}]: ${r.outcome.toUpperCase()}\n${r.trace
        .map((t) => `  - ${t.criterion}: ${t.met === null ? 'UNKNOWN' : t.met ? 'met' : 'NOT met'} (${t.evidence})`)
        .join('\n')}${r.flags.length ? `\n  Flags: ${r.flags.join('; ')}` : ''}`,
  )
  .join('\n')}

Return JSON:
{
 "schemes": { "<scheme id>": { "explanation": string (2 short sentences in ${langName}, to the client, explaining the outcome kindly; for needs_info say what is missing; never promise a payment), "toFinish": string[] (0-3 short things they need to finish this, in ${langName}) } } for each of ${results.map((r) => r.scheme).join(', ')},
 "clientSummary": string (2 sentences in ${langName}, to the client: what happens next is an adviser checks and approves),
 "adviserSummary": string (exactly 3 short lines separated by \\n, English, for an adviser queue: who, what happened, what they need),
 "caseNote": string (English, third person, under 110 words, with labels Household:, Circumstances:, Income:, Need:, Pre-check:),
 "issues": array of the root-cause legal issues behind the crisis, chosen from ${JSON.stringify(ISSUE_TYPES)},
 "flags": string[] (0-4 short English notes for the adviser: contradictions, missing evidence, risks),
 ${SAFEGUARDING_RULE}
}`,
        parse: (raw) => {
          const o = obj(raw);
          const schemes: Ai['schemes'] = {};
          const s = o.schemes && typeof o.schemes === 'object' ? (o.schemes as Record<string, unknown>) : {};
          for (const r of results) {
            const e = s[r.scheme] && typeof s[r.scheme] === 'object' ? (s[r.scheme] as Record<string, unknown>) : {};
            schemes[r.scheme] = { explanation: str(e.explanation, 500), toFinish: strArr(e.toFinish, 3, 160) };
          }
          return {
            schemes,
            clientSummary: str(o.clientSummary, 600),
            adviserSummary: str(o.adviserSummary, 400),
            caseNote: str(o.caseNote, 1200),
            issues: strArr(o.issues, 6, 60).filter((i): i is IssueType => (ISSUE_TYPES as readonly string[]).includes(i)),
            flags: strArr(o.flags, 4, 200),
            safeguarding: str(o.safeguarding, 400),
          };
        },
      });
      ai = out.data;
      meta = out.meta;
    } catch (err) {
      console.warn('assess AI failed, using rules only', err);
    }

    // Fallback issue triage from the structured reasons if the AI is unavailable.
    const reasons = c.facts.reasons ?? [];
    const issues: IssueType[] = ai?.issues.length
      ? ai.issues
      : [
          ...(reasons.includes('benefit_change') ? (['benefit_sanction_or_decision'] as const) : []),
          ...(reasons.includes('benefit_delay') ? (['benefit_delay'] as const) : []),
          ...(reasons.includes('debt') ? (['problem_debt'] as const) : []),
          ...(reasons.includes('housing') ? (['rent_arrears_or_eviction'] as const) : []),
        ];

    const outcomeText = { likely: 'You are likely to qualify.', unlikely: 'You are unlikely to qualify.', needs_info: 'We need a bit more information.' };
    const f = c.facts;
    const urgent =
      f.foodAtHome === 'none' ||
      reasons.includes('relationship') ||
      f.moneyAvailablePence === 0 ||
      (f.meterCreditPence !== undefined && f.meterCreditPence <= 0 && (f.children ?? 0) > 0);

    await ctx.runMutation(internal.cases.saveAssessment, {
      caseId,
      eligibility: results.map((r) => ({
        scheme: r.scheme,
        outcome: r.outcome,
        trace: r.trace,
        flags: r.flags,
        explanation: ai?.schemes[r.scheme]?.explanation ?? outcomeText[r.outcome],
        toFinish: ai?.schemes[r.scheme]?.toFinish ?? r.trace.filter((t) => t.met === null).map((t) => t.criterion),
        rulesetVersion: RULESET_VERSION,
      })),
      actions: buildActionPlan(issues, c.facts),
      issues,
      clientSummary: ai?.clientSummary ?? 'An adviser will check your answers and approve the help you can get. You don’t need to explain everything again.',
      adviserSummary:
        ai?.adviserSummary ??
        `${c.facts.adults ?? '?'} adult(s), ${c.facts.children ?? '?'} child(ren), ${c.facts.postcodeDistrict ?? 'area unknown'}\n${c.story.slice(0, 90)}\nPre-check: ${results.map((r) => `${SCHEME_INFO[r.scheme].name} ${r.outcome}`).join(', ')}`,
      caseNote: ai?.caseNote ?? `Household: ${c.facts.adults ?? '?'} adult(s), ${c.facts.children ?? '?'} child(ren).\nCircumstances: ${c.story}\nPre-check: rules only (AI unavailable).`,
      adviserFlags: [...results.flatMap((r) => r.flags), ...(ai?.flags ?? [])],
      safeguarding: ai?.safeguarding,
      urgent,
      meta,
    });
    return null;
  },
});
