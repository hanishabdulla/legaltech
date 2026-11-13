import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, internalQuery, query } from './_generated/server';
import { answersValidator, decisionValidator, followUpValidator } from './schema';
import { FAST_MODEL, SMART_MODEL, geminiJson } from './lib/gemini';
import { SIX_MONTHS_MS, applyPolicy } from './lib/policy';
import { describeAnswers } from './lib/questions';

const TONE = `You are the friendly assistant inside "Common Counsel", a UK app that helps people in hardship get emergency food and fuel vouchers and connects them to Citizens Advice.
Write in warm, calm, plain British English at a reading age of about 9. Never judge or lecture. Never give legal advice; give information and point to free help.`;

/** Up to two short, AI-chosen follow-up questions based on the answers so far. */
export const followUps = action({
  args: { answers: answersValidator },
  handler: async (_ctx, { answers }) => {
    try {
      const out = await geminiJson<{ questions?: { question: string; suggestions?: string[] }[] }>({
        model: FAST_MODEL,
        timeoutMs: 12000,
        system: TONE,
        prompt: `Someone has just answered a short food support check:
${describeAnswers(answers)}

Choose 0 to 2 short follow-up questions that would genuinely help an adviser decide what support they need (for example when a delayed payment is due, whether children get free school meals, whether they are safe at home, whether they have a prepayment meter). Do not repeat anything already answered. Do not ask for bank details, names or documents.
Each question must be one sentence, under 15 words. Give 2 to 4 short tap-to-answer suggestions for each.
Respond as JSON: {"questions":[{"question":string,"suggestions":string[]}]}`,
      });
      return (out.questions ?? [])
        .filter((q) => typeof q.question === 'string' && q.question.trim())
        .slice(0, 2)
        .map((q) => ({
          question: q.question.trim(),
          suggestions: (q.suggestions ?? []).filter((s) => typeof s === 'string').slice(0, 4),
        }));
    } catch (err) {
      console.warn('followUps failed, skipping', err);
      return [];
    }
  },
});

type AiDecision = {
  eligible?: boolean;
  headline?: string;
  summary?: string;
  reasons?: string[];
  nextSteps?: { title: string; detail: string }[];
  safeguarding?: string | null;
  caseNote?: string;
};

/** Runs the eligibility check: rules for values and limits, Gemini for the decision and wording. */
export const assess = action({
  args: {
    userId: v.id('users'),
    answers: answersValidator,
    followUps: v.array(followUpValidator),
  },
  handler: async (ctx, { userId, answers, followUps }): Promise<Id<'assessments'>> => {
    const user = await ctx.runQuery(internal.assessments.userExists, { userId });
    if (!user) throw new ConvexError('Please sign in again.');

    const recentFood = await ctx.runQuery(internal.assessments.recentFoodVoucherCount, { userId });
    const policy = applyPolicy(answers, recentFood);
    const money = (p: number) => `£${(p / 100).toFixed(2)}`;

    let ai: AiDecision | null = null;
    try {
      ai = await geminiJson<AiDecision>({
        model: SMART_MODEL,
        system: TONE,
        prompt: `Assess this request for an emergency supermarket food voucher.

ANSWERS
${describeAnswers(answers)}
${followUps.map((f) => `Follow-up: ${f.question} -> ${f.answer || '(skipped)'}`).join('\n')}

POLICY (follow it)
- Eligible if any of: receives a means-tested benefit, very low income, a recent crisis, or little or no food at home.
- ${policy.blockedReason ? `NOT eligible: ${policy.blockedReason}` : `Rules engine says: ${policy.eligible ? 'eligible' : 'not eligible'}. Signals: ${policy.signals.join(', ') || 'none'}.`}
- If eligible, the food voucher is ${money(policy.foodValuePence)}${policy.fuelValuePence ? ` and a ${money(policy.fuelValuePence)} energy top-up voucher` : ''}. Do not mention other amounts.
- You may only overrule the rules engine to make someone eligible when their own words clearly show a real need for food today. Never overrule a limit.

Respond as JSON with exactly these keys:
{
 "eligible": boolean,
 "headline": string (max 8 words, speaking to them, e.g. "You can get a food voucher today"),
 "summary": string (2 sentences, to them, explaining the outcome kindly),
 "reasons": string[] (2-3 short reasons for the decision, to them),
 "nextSteps": [{"title": string, "detail": string}] (2-4 other UK help they could get, chosen for their situation, e.g. Council Tax Reduction, Healthy Start, free school meals, Warm Home Discount, Priority Services Register, local welfare assistance, Citizens Advice debt help, a Universal Credit advance. One sentence each),
 "safeguarding": string or null (only if there is any sign of domestic abuse, risk to children or risk to life: one kind sentence pointing to 999 in an emergency or the National Domestic Abuse Helpline 0808 2000 247),
 "caseNote": string (an adviser case note in third person, under 90 words, with the labels Household:, Circumstances:, Income:, Need:, Outcome:)
}`,
      });
    } catch (err) {
      console.warn('assess AI failed, using rules only', err);
    }

    // Limits always win. Otherwise the AI can add eligibility but never remove it.
    const eligible = !policy.blockedReason && (policy.eligible || ai?.eligible === true);
    // If the AI's wording describes a different outcome, don't show it.
    if (ai && ai.eligible !== eligible) ai = { nextSteps: ai.nextSteps, safeguarding: ai.safeguarding, caseNote: ai.caseNote };
    // If the AI made someone eligible the rules did not, still give the base food value.
    const foodValuePence = eligible ? policy.foodValuePence || 3000 : 0;
    const fuelValuePence = eligible ? policy.fuelValuePence : 0;

    const fallbackSummary = policy.blockedReason
      ? `${policy.blockedReason} Citizens Advice can still help you look at other support.`
      : eligible
        ? 'Based on your answers, you can get an emergency food voucher today. Choose your supermarket and it will be saved in your wallet.'
        : 'Based on your answers, you can’t get a food voucher right now. There may still be other support you can get.';

    const decision = {
      eligible,
      urgency: policy.urgent ? ('urgent' as const) : ('standard' as const),
      headline:
        ai?.headline?.trim() ||
        (eligible ? 'You can get a food voucher today' : 'We can’t give a voucher this time'),
      summary: ai?.summary?.trim() || fallbackSummary,
      reasons: (ai?.reasons ?? policy.signals).filter(Boolean).slice(0, 3),
      nextSteps: (ai?.nextSteps ?? [
        {
          title: 'Talk to Citizens Advice',
          detail: 'They can check you’re getting all the benefits and help you’re entitled to.',
        },
      ])
        .filter((s) => s && s.title)
        .slice(0, 4),
      safeguarding: ai?.safeguarding?.trim() || undefined,
      caseNote:
        ai?.caseNote?.trim() ||
        `Household: ${answers.adults} adult(s), ${answers.children} child(ren). Outcome: ${eligible ? 'eligible' : 'not eligible'} (rules only, AI unavailable).`,
      foodValuePence,
      fuelValuePence,
      aiGenerated: ai !== null,
    };

    return await ctx.runMutation(internal.assessments.save, { userId, answers, followUps, decision });
  },
});

export const save = internalMutation({
  args: {
    userId: v.id('users'),
    answers: answersValidator,
    followUps: v.array(followUpValidator),
    decision: decisionValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('assessments', { ...args, createdAt: Date.now() });
  },
});

export const userExists = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId)) !== null,
});

export const recentFoodVoucherCount = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const since = Date.now() - SIX_MONTHS_MS;
    const vouchers = await ctx.db
      .query('vouchers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return vouchers.filter((v) => v.kind === 'food' && v.issuedAt >= since).length;
  },
});

export const get = query({
  args: { userId: v.id('users'), assessmentId: v.id('assessments') },
  handler: async (ctx, { userId, assessmentId }) => {
    const a = await ctx.db.get(assessmentId);
    if (!a || a.userId !== userId) return null;
    const vouchers = await ctx.db
      .query('vouchers')
      .withIndex('by_assessment', (q) => q.eq('assessmentId', assessmentId))
      .collect();
    return { ...a, vouchers };
  },
});
