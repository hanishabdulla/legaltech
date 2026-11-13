import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from './_generated/server';
import type { RetrievedChunk } from './legislation';
import { audit, requireBusiness, requireBusinessMatter } from './lib/auth';
import {
  TOPICS,
  finalUrgency,
  flagRules,
  guardCitations,
  keywordTriage,
  renderCitationMarkers,
  type DraftAnswer,
  type Flag,
  type Topic,
  type Triage,
} from './lib/flags';
import { FAST_MODEL, SMART_MODEL, TONE_BUSINESS, clientText, geminiJson, obj, str, strArr, type GeminiMeta } from './lib/gemini';
import { flagValidator } from './lib/remedySchema';
import { dueAtFor } from './lib/serviceLevel';
import { recomputeTraction } from './traction';

/**
 * Matters: the founder's legal questions (mvp2.md §6.2–6.3).
 * The AI reads, retrieves and drafts; lib/flags.ts decides what needs a lawyer.
 */

export const matterRef = (id: string) => `R-${id.slice(-6).toUpperCase()}`;

// ---------- Public (business) ----------

export const ask = mutation({
  args: { token: v.string(), question: v.string() },
  handler: async (ctx, { token, question }) => {
    const business = await requireBusiness(ctx, token);
    const q = question.trim();
    if (q.length < 8) throw new ConvexError('Please describe the issue in a sentence or two.');
    const now = Date.now();
    const matterId = await ctx.db.insert('matters', {
      businessId: business._id,
      question: q.slice(0, 3000),
      topic: 'other',
      urgency: 'standard',
      status: 'answering',
      flags: [],
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { matterId, actor: 'client', event: 'matter_asked' });
    await ctx.scheduler.runAfter(0, internal.matters.answer, { matterId });
    await recomputeTraction(ctx, business._id);
    return matterId;
  },
});

export const mine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const business = await requireBusiness(ctx, token);
    const matters = await ctx.db
      .query('matters')
      .withIndex('by_businessId', (q) => q.eq('businessId', business._id))
      .order('desc')
      .take(50);
    return matters.map((m) => ({
      _id: m._id,
      ref: matterRef(m._id),
      question: m.question,
      topic: m.topic,
      status: m.status,
      urgency: m.urgency,
      flagCodes: m.flags.map((f) => f.code),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  },
});

async function staffName(ctx: QueryCtx, id: Id<'staff'> | undefined) {
  if (!id) return undefined;
  return (await ctx.db.get(id))?.name;
}

export async function matterDocuments(ctx: QueryCtx, matterId: Id<'matters'>) {
  const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(20);
  return await Promise.all(
    docs.map(async (d) => ({
      _id: d._id,
      kind: d.kind,
      status: d.status,
      summary: d.summary,
      clauses: clausesOf(d),
      submitted: d.confirmedByClient,
      createdAt: d.createdAt,
      url: await ctx.storage.getUrl(d.storageId),
    })),
  );
}

export type Clause = { title: string; text: string; why: string; risk: 'high' | 'medium' | 'low' };
export function clausesOf(d: Doc<'documents'>): Clause[] {
  const raw = (d.extracted as { clauses?: unknown } | undefined)?.clauses;
  return Array.isArray(raw) ? (raw as Clause[]) : [];
}

export const get = query({
  args: { token: v.string(), matterId: v.id('matters') },
  handler: async (ctx, { token, matterId }) => {
    const { matter } = await requireBusinessMatter(ctx, token, matterId);
    const [answer, messages, documents] = await Promise.all([
      ctx.db.query('aiAnswers').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').first(),
      ctx.db.query('matterMessages').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(50),
      matterDocuments(ctx, matterId),
    ]);
    return {
      _id: matter._id,
      ref: matterRef(matter._id),
      question: matter.question,
      topic: matter.topic,
      urgency: matter.urgency,
      status: matter.status,
      flags: matter.flags,
      createdAt: matter.createdAt,
      dueAt: matter.dueAt,
      draft: answer
        ? { answer: answer.answer, citations: answer.citations, nextStep: answer.nextStep, confidence: answer.confidence }
        : null,
      finalAnswer: matter.finalAnswer,
      checkedBy: await staffName(ctx, matter.checkedByStaffId),
      checkedAt: matter.checkedAt,
      messages: await Promise.all(
        messages.map(async (m) => ({ _id: m._id, from: m.from, text: m.text, at: m.at, name: m.from === 'lawyer' ? await staffName(ctx, m.staffId) : undefined })),
      ),
      documents,
    };
  },
});

/** The client answers a lawyer's request for information. */
export const reply = mutation({
  args: { token: v.string(), matterId: v.id('matters'), text: v.string() },
  handler: async (ctx, { token, matterId, text }) => {
    const { matter } = await requireBusinessMatter(ctx, token, matterId);
    if (matter.status !== 'awaiting_client') throw new ConvexError('Our lawyer hasn’t asked for anything on this matter.');
    if (!text.trim()) throw new ConvexError('Please write a reply.');
    await ctx.db.insert('matterMessages', { matterId, from: 'client', text: text.trim().slice(0, 3000), at: Date.now() });
    await ctx.db.patch(matterId, { status: 'in_review', updatedAt: Date.now() });
    await audit(ctx, { matterId, actor: 'client', event: 'client_replied' });
    await ctx.scheduler.runAfter(0, internal.matters.summarise, { matterId });
  },
});

// ---------- Internal: answer + flag ----------

export const loadForAnswer = internalQuery({
  args: { matterId: v.id('matters') },
  handler: async (ctx, { matterId }) => {
    const matter = await ctx.db.get(matterId);
    if (!matter) return null;
    const business = await ctx.db.get(matter.businessId);
    if (!business) return null;
    const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(20);
    return {
      question: matter.question,
      // Minimum data to the AI: no business name or company number.
      business: { sector: business.sector, headcount: business.headcount, stage: business.stage },
      hasDocument: docs.some((d) => d.confirmedByClient),
    };
  },
});

function parseTriage(raw: unknown): Triage {
  const o = obj(raw);
  const topic = (TOPICS as readonly string[]).includes(o.topic as string) ? (o.topic as Topic) : 'other';
  const value = typeof o.valueAtStakePence === 'number' && o.valueAtStakePence >= 0 ? Math.round(o.valueAtStakePence) : null;
  const reserved = ['litigation', 'conveyancing', 'probate'].includes(o.reservedActivity as string) ? (o.reservedActivity as string) : null;
  return {
    topic,
    urgency: o.urgency === 'high' ? 'high' : 'standard',
    outOfScope: o.outOfScope === true,
    outOfScopeReason: str(o.outOfScopeReason, 300) ?? null,
    valueAtStakePence: value,
    deadlineMentioned: o.deadlineMentioned === true,
    reservedActivity: reserved,
    sharesOrInvestment: o.sharesOrInvestment === true,
  };
}

function parseDraft(raw: unknown): DraftAnswer {
  const o = obj(raw);
  const answer = str(o.answer, 3000);
  if (!answer) throw new Error('No answer');
  const citations = Array.isArray(o.citations)
    ? o.citations
        .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
        .filter((c) => typeof c.chunkId === 'string')
        .map((c) => ({ chunkId: c.chunkId as string, act: str(c.act, 200) ?? '', section: str(c.section, 40) ?? '' }))
        .slice(0, 10)
    : [];
  const needsJudgement = Array.isArray(o.needsJudgement)
    ? o.needsJudgement
        .map((j) => (j && typeof j === 'object' ? (j as Record<string, unknown>) : {}))
        .map((j) => ({ reason: str(j.reason, 400) ?? '', questionForLawyer: str(j.questionForLawyer, 400) ?? '' }))
        .filter((j) => j.reason)
        .slice(0, 5)
    : [];
  return {
    answer,
    citations,
    needsJudgement,
    missingFacts: strArr(o.missingFacts, 6, 200),
    confidence: typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0.5,
    nextStep: str(o.nextStep, 400) ?? '',
  };
}

const chunkBlock = (chunks: RetrievedChunk[]) =>
  chunks
    .map((c) => `<chunk chunkId="${c._id}" act="${c.act}" section="${c.section}">\n${c.heading}\n${c.text.slice(0, 2500)}\n</chunk>`)
    .join('\n');

export const answer = internalAction({
  args: { matterId: v.id('matters') },
  handler: async (ctx, { matterId }) => {
    const m = await ctx.runQuery(internal.matters.loadForAnswer, { matterId });
    if (!m) return;
    const metas: (GeminiMeta & { step: string })[] = [];
    const profile = `Business: ${m.business.sector}, ${m.business.headcount} staff, stage "${m.business.stage}", England and Wales.`;

    // Step A: triage (fast model), keyword fallback.
    let triage: Triage;
    try {
      const r = await geminiJson({
        model: FAST_MODEL,
        system: TONE_BUSINESS,
        prompt: `Triage this small business legal question. ${profile}
${clientText(m.question)}
Return JSON: {"topic": one of ${TOPICS.join(' | ')}, "urgency": "high" | "standard", "outOfScope": boolean (criminal, immigration, family, or outside England and Wales), "outOfScopeReason": string | null, "valueAtStakePence": number | null (only if a money amount is stated), "deadlineMentioned": boolean (tribunal, limitation period, court date, or a deadline within 14 days), "reservedActivity": "litigation" | "conveyancing" | "probate" | null (only if they need someone to conduct court proceedings, transfer land, or deal with probate), "sharesOrInvestment": boolean (shares, equity, investors or a funding round)}`,
        parse: parseTriage,
      });
      triage = r.data;
      metas.push({ ...r.meta, step: 'triage' });
    } catch (err) {
      console.warn('triage failed, using keywords', String(err).slice(0, 200));
      triage = keywordTriage(m.question);
    }

    // Retrieval.
    const { chunks, method } = await ctx.runAction(internal.legislation.retrieve, { question: m.question, topic: triage.topic });

    // Step B: answer (smart model) from the retrieved chunks only.
    let draft: DraftAnswer | null = null;
    if (chunks.length) {
      try {
        const r = await geminiJson({
          model: SMART_MODEL,
          timeoutMs: 45000,
          system: TONE_BUSINESS,
          prompt: `${profile}
Question:
${clientText(m.question)}

<legislation>
${chunkBlock(chunks)}
</legislation>

Return JSON: {"answer": string (plain English, under 300 words, information not advice), "citations": [{"chunkId": string (exactly as given), "act": string, "section": string}] (you may also mark statements inline with [chunkId]), "needsJudgement": [{"reason": string, "questionForLawyer": string}], "missingFacts": [string], "confidence": number 0..1, "nextStep": string (one practical next step)}`,
          parse: parseDraft,
        });
        draft = r.data;
        metas.push({ ...r.meta, step: 'answer' });
      } catch (err) {
        console.warn('answer failed', String(err).slice(0, 200));
      }
    }

    // Citation guard + flag rules (code, not AI).
    const guarded = guardCitations(draft?.citations ?? [], chunks);
    const flags = flagRules({ triage, draft, citationsDropped: guarded.dropped, stage: m.business.stage, hasDocument: m.hasDocument });

    await ctx.runMutation(internal.matters.saveAnswer, {
      matterId,
      topic: triage.topic,
      urgency: finalUrgency(triage),
      flags,
      draft: draft
        ? {
            answer: renderCitationMarkers(draft.answer, guarded.citations),
            citations: guarded.citations,
            confidence: draft.confidence,
            nextStep: draft.nextStep,
            model: metas.find((x) => x.step === 'answer')?.model ?? SMART_MODEL,
            promptHash: metas.find((x) => x.step === 'answer')?.promptHash ?? '',
          }
        : undefined,
      meta: { calls: metas, retrieval: method, chunks: chunks.length, citationsDropped: guarded.dropped },
    });
  },
});

export const saveAnswer = internalMutation({
  args: {
    matterId: v.id('matters'),
    topic: v.string(),
    urgency: v.union(v.literal('high'), v.literal('standard')),
    flags: v.array(flagValidator),
    draft: v.optional(
      v.object({
        answer: v.string(),
        citations: v.array(v.object({ chunkId: v.id('legislationChunks'), act: v.string(), section: v.string(), url: v.string() })),
        confidence: v.number(),
        nextStep: v.string(),
        model: v.string(),
        promptHash: v.string(),
      }),
    ),
    meta: v.any(),
  },
  handler: async (ctx, { matterId, topic, urgency, flags, draft, meta }) => {
    const matter = await ctx.db.get(matterId);
    if (!matter) return;
    const now = Date.now();
    if (draft) await ctx.db.insert('aiAnswers', { matterId, ...draft, createdAt: now });
    const flagged = flags.length > 0;
    await ctx.db.patch(matterId, {
      topic,
      urgency,
      flags,
      status: flagged ? 'in_review' : 'answered',
      dueAt: flagged ? dueAtFor(urgency, now) : undefined,
      updatedAt: now,
    });
    await audit(ctx, {
      matterId,
      actor: 'ai:matters.answer',
      event: flagged ? 'answer_flagged' : 'answer_given',
      detail: { ...meta, flags: flags.map((f) => f.code) },
    });
    if (flagged) await ctx.scheduler.runAfter(0, internal.matters.summarise, { matterId });
    await recomputeTraction(ctx, matter.businessId);
  },
});

/** Adds a flag (e.g. DOC_REVIEW) and sends the matter to the lawyer queue. */
export async function addFlagAndReview(
  ctx: Parameters<typeof recomputeTraction>[0],
  matter: Doc<'matters'>,
  flag: Flag,
) {
  const flags = matter.flags.some((f) => f.code === flag.code) ? matter.flags : [...matter.flags, flag];
  const now = Date.now();
  await ctx.db.patch(matter._id, {
    flags,
    status: 'in_review',
    dueAt: matter.status === 'in_review' && matter.dueAt ? matter.dueAt : dueAtFor(matter.urgency, now),
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.matters.summarise, { matterId: matter._id });
}

// ---------- Internal: matter summary ----------

export const loadForSummary = internalQuery({
  args: { matterId: v.id('matters') },
  handler: async (ctx, { matterId }) => {
    const matter = await ctx.db.get(matterId);
    if (!matter) return null;
    const business = await ctx.db.get(matter.businessId);
    const [answer, docs, messages] = await Promise.all([
      ctx.db.query('aiAnswers').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').first(),
      ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(10),
      ctx.db.query('matterMessages').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(30),
    ]);
    return {
      question: matter.question,
      flags: matter.flags,
      business: business ? { sector: business.sector, headcount: business.headcount, stage: business.stage } : null,
      draft: answer ? { answer: answer.answer, citations: answer.citations.map((c) => `${c.act} s.${c.section}`) } : null,
      documents: docs.filter((d) => d.confirmedByClient).map((d) => ({ kind: d.kind, summary: d.summary ?? '', clauses: clausesOf(d) })),
      messages: messages.map((m) => ({ from: m.from, text: m.text })),
    };
  },
});

export const summarise = internalAction({
  args: { matterId: v.id('matters') },
  handler: async (ctx, { matterId }) => {
    const m = await ctx.runQuery(internal.matters.loadForSummary, { matterId });
    if (!m) return;
    const fallback = () => ({
      facts: [{ fact: m.question.slice(0, 300), source: 'client' }, ...m.documents.map((d) => ({ fact: d.summary, source: 'document' }))].filter((f) => f.fact),
      unknowns: m.flags.filter((f) => f.code === 'MISSING_FACTS').map((f) => f.reason),
      questionsForLawyer: m.flags.map((f) => f.questionForLawyer),
      replyOptions: [] as string[],
    });
    try {
      const { data, meta } = await geminiJson({
        model: SMART_MODEL,
        timeoutMs: 45000,
        system: `${TONE_BUSINESS}\nYou are now writing an internal matter summary for a Remedy solicitor, not for the client. Be precise and neutral.`,
        prompt: `Business: ${m.business ? `${m.business.sector}, ${m.business.headcount} staff, stage ${m.business.stage}` : 'unknown'}.
Question (client's words):
${clientText(m.question)}
${m.messages.length ? `Messages so far:\n${m.messages.map((x) => `${x.from}: ${clientText(x.text)}`).join('\n')}` : ''}
${m.documents.length ? `Documents:\n${m.documents.map((d) => `${d.kind}: ${d.summary}\nHighlighted clauses: ${d.clauses.map((c) => `${c.title} (${c.risk}): ${c.why}`).join('; ')}`).join('\n')}` : ''}
AI draft answer: ${m.draft ? m.draft.answer : 'none (AI failed)'}
Legislation relied on: ${m.draft?.citations.join(', ') || 'none'}
Flags: ${m.flags.map((f) => `${f.code}: ${f.reason}`).join(' | ')}

Return JSON: {"facts": [{"fact": string, "source": "client" | "document"}] (only facts actually stated), "unknowns": [string] (facts that would change the answer), "questionsForLawyer": [string], "replyOptions": [string] (exactly 2 alternative short replies the lawyer could send, labelled by approach, e.g. "A: ..." and "B: ...")}`,
        parse: (raw) => {
          const o = obj(raw);
          const facts = Array.isArray(o.facts)
            ? o.facts
                .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
                .map((f) => ({ fact: str(f.fact, 300) ?? '', source: f.source === 'document' && m.documents.length ? 'document' : 'client' }))
                .filter((f) => f.fact)
                .slice(0, 10)
            : [];
          return {
            facts,
            unknowns: strArr(o.unknowns, 8, 300),
            questionsForLawyer: strArr(o.questionsForLawyer, 6, 400),
            replyOptions: strArr(o.replyOptions, 2, 1200),
          };
        },
      });
      await ctx.runMutation(internal.matters.saveSummary, { matterId, ...data, meta });
    } catch (err) {
      console.warn('summary failed, using fallback', String(err).slice(0, 200));
      await ctx.runMutation(internal.matters.saveSummary, { matterId, ...fallback(), meta: { fallback: true } });
    }
  },
});

export const saveSummary = internalMutation({
  args: {
    matterId: v.id('matters'),
    facts: v.array(v.object({ fact: v.string(), source: v.string() })),
    unknowns: v.array(v.string()),
    questionsForLawyer: v.array(v.string()),
    replyOptions: v.array(v.string()),
    meta: v.any(),
  },
  handler: async (ctx, { matterId, meta, ...summary }) => {
    if (!(await ctx.db.get(matterId))) return;
    await ctx.db.insert('matterSummaries', { matterId, ...summary, createdAt: Date.now() });
    await audit(ctx, { matterId, actor: 'ai:matters.summarise', event: 'summary_written', detail: meta });
  },
});
