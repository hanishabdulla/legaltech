import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { audit, requireClient, requireClientCase } from './lib/auth';
import { FACT_KEYS, factChips, factsValidator, missingFacts, sanitiseFacts, type Facts, type FactSource } from './lib/facts';
import { buildReferralPayload } from './lib/referralPayload';
import { SCHEME_INFO, type SchemeId } from './lib/schemes';
import { outcomeValidator } from './schema';

const MAX_CASES = 20;
export const MAX_CLIENT_TURNS = 8;
export const MIN_CONFIDENCE = 0.6;

/** Merge new facts into a case. Facts below MIN_CONFIDENCE are recorded but not used. */
export function mergeFacts(c: Doc<'cases'>, incoming: Facts, source: FactSource, confidence: Record<string, number> = {}) {
  const facts: Facts = { ...c.facts };
  const factConfidence = { ...c.factConfidence };
  const factSources = { ...c.factSources };
  for (const key of FACT_KEYS) {
    const value = incoming[key];
    if (value === undefined) continue;
    const conf = source === 'client' && confidence[key] !== undefined ? confidence[key] : 1;
    factConfidence[key] = conf;
    if (conf < MIN_CONFIDENCE) continue;
    (facts as Record<string, unknown>)[key] = value;
    factSources[key] = source;
  }
  return { facts: sanitiseFacts(facts as Record<string, unknown>), factConfidence, factSources };
}

/** Everything the client needs to see about a case. */
async function caseView(ctx: QueryCtx, c: Doc<'cases'>) {
  const [documents, eligibility, referrals, actions, vouchers] = await Promise.all([
    ctx.db.query('documents').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(20),
    ctx.db.query('eligibility').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10),
    ctx.db.query('referrals').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10),
    ctx.db.query('actions').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(20),
    ctx.db.query('vouchers').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10),
  ]);
  return {
    ...c,
    chips: factChips(c.facts),
    missing: missingFacts(c.facts).map((m) => m.key),
    documents: await Promise.all(documents.map(async (d) => ({ ...d, url: await ctx.storage.getUrl(d.storageId) }))),
    eligibility: eligibility.map((e) => ({ ...e, info: SCHEME_INFO[e.scheme as SchemeId] })),
    referrals: referrals.map((r) => ({ ...r, info: SCHEME_INFO[r.scheme as SchemeId] })),
    actions: actions.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity)),
    vouchers,
  };
}
export type CaseView = Awaited<ReturnType<typeof caseView>>;

// ---------- Client API ----------

export const create = mutation({
  args: { token: v.string(), story: v.string() },
  handler: async (ctx, { token, story }) => {
    const client = await requireClient(ctx, token);
    const text = story.trim().slice(0, 2000);
    const now = Date.now();
    const caseId = await ctx.db.insert('cases', {
      clientId: client._id,
      status: 'draft',
      facts: {},
      factConfidence: {},
      factSources: {},
      story: text,
      transcript: [],
      intakeDone: false,
      urgency: 'standard',
      issues: [],
      adviserFlags: [],
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { caseId, actor: 'client', event: 'case_created' });
    return caseId;
  },
});

export const mine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const client = await requireClient(ctx, token);
    const cases = await ctx.db
      .query('cases')
      .withIndex('by_clientId', (q) => q.eq('clientId', client._id))
      .order('desc')
      .take(MAX_CASES);
    return cases.map((c) => ({ _id: c._id, status: c.status, story: c.story, createdAt: c.createdAt, intakeDone: c.intakeDone, assessed: !!c.assessedAt }));
  },
});

export const get = query({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    return await caseView(ctx, c);
  },
});

function assertEditable(c: Doc<'cases'>) {
  if (c.status !== 'draft') throw new ConvexError('This case has been sent to an adviser, so it can’t be changed here.');
}

/** Step-by-step form answers. */
export const setFacts = mutation({
  args: { token: v.string(), caseId: v.id('cases'), facts: factsValidator },
  handler: async (ctx, { token, caseId, facts }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    assertEditable(c);
    const merged = mergeFacts(c, sanitiseFacts(facts), 'client');
    const missing = missingFacts(merged.facts);
    await ctx.db.patch(caseId, {
      ...merged,
      intakeDone: missing.length === 0 || c.intakeDone,
      nextQuestion: undefined,
      assessedAt: undefined,
      updatedAt: Date.now(),
    });
    await audit(ctx, { caseId, actor: 'client', event: 'facts_set', detail: { keys: Object.keys(facts) } });
  },
});

/** "That's not right": forget a fact so it gets asked again. */
export const removeFact = mutation({
  args: { token: v.string(), caseId: v.id('cases'), key: v.string() },
  handler: async (ctx, { token, caseId, key }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    assertEditable(c);
    const facts = { ...c.facts } as Record<string, unknown>;
    const keys = key === 'adults' || key === 'children' ? ['adults', 'children'] : key === 'postcodeDistrict' ? ['postcodeDistrict', 'leedsResident'] : [key];
    for (const k of keys) delete facts[k];
    await ctx.db.patch(caseId, { facts: facts as Facts, intakeDone: false, assessedAt: undefined, nextQuestion: undefined, updatedAt: Date.now() });
    await audit(ctx, { caseId, actor: 'client', event: 'fact_removed', detail: { keys } });
  },
});

export const setRetailer = mutation({
  args: { token: v.string(), caseId: v.id('cases'), retailer: v.string() },
  handler: async (ctx, { token, caseId, retailer }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    assertEditable(c);
    await ctx.db.patch(caseId, { retailer: retailer.slice(0, 40) });
  },
});

/** Sends the case to an adviser: creates a pending referral for each scheme worth pursuing. */
export const submit = mutation({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    if (c.status !== 'draft') return;
    if (!c.assessedAt) throw new ConvexError('Please check what you can get first.');

    const eligibility = await ctx.db.query('eligibility').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(10);
    const now = Date.now();
    for (const e of eligibility) {
      if (e.outcome === 'unlikely') continue;
      await ctx.db.insert('referrals', {
        caseId,
        scheme: e.scheme,
        payload: buildReferralPayload(e.scheme as SchemeId, c),
        status: 'pending',
        createdAt: now,
      });
    }
    await ctx.db.patch(caseId, { status: 'submitted', submittedAt: now, updatedAt: now });
    await audit(ctx, { caseId, actor: 'client', event: 'submitted_to_adviser' });
  },
});

export const setActionStatus = mutation({
  args: { token: v.string(), actionId: v.id('actions'), status: v.union(v.literal('todo'), v.literal('done'), v.literal('handed_off')) },
  handler: async (ctx, { token, actionId, status }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError('Action not found.');
    await requireClientCase(ctx, token, action.caseId);
    await ctx.db.patch(actionId, { status });
  },
});

// ---------- Internal (used by AI actions) ----------

export const loadForClient = internalQuery({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    const { client, case: c } = await requireClientCase(ctx, token, caseId);
    return { case: c, language: client.language };
  },
});

export const applyIntake = internalMutation({
  args: {
    caseId: v.id('cases'),
    clientText: v.optional(v.string()),
    facts: factsValidator,
    confidence: v.record(v.string(), v.number()),
    assistantText: v.optional(v.string()),
    nextQuestion: v.optional(v.object({ key: v.string(), text: v.string(), suggestions: v.array(v.string()) })),
    safeguarding: v.optional(v.string()),
    done: v.boolean(),
    meta: v.any(),
  },
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.caseId);
    if (!c || c.status !== 'draft') return;
    const now = Date.now();
    const transcript = [...c.transcript];
    if (a.clientText) transcript.push({ role: 'client', text: a.clientText, at: now });
    if (a.assistantText) transcript.push({ role: 'assistant', text: a.assistantText, at: now });

    const merged = mergeFacts(c, a.facts, 'client', a.confidence);
    await ctx.db.patch(a.caseId, {
      ...merged,
      transcript: transcript.slice(-40),
      nextQuestion: a.done ? undefined : a.nextQuestion,
      intakeDone: a.done,
      assessedAt: undefined,
      // Safeguarding can only be raised, never cleared, by the AI.
      safeguardingFlag: c.safeguardingFlag ?? a.safeguarding,
      urgency: c.urgency === 'urgent' || a.safeguarding ? 'urgent' : c.urgency,
      updatedAt: now,
    });
    await audit(ctx, { caseId: a.caseId, actor: 'ai:intake.turn', event: 'facts_extracted', detail: { ...a.meta, keys: Object.keys(a.facts) } });
  },
});

export const saveAssessment = internalMutation({
  args: {
    caseId: v.id('cases'),
    eligibility: v.array(
      v.object({
        scheme: v.string(),
        outcome: outcomeValidator,
        trace: v.array(v.object({ criterion: v.string(), met: v.union(v.boolean(), v.null()), evidence: v.string() })),
        flags: v.array(v.string()),
        explanation: v.optional(v.string()),
        toFinish: v.array(v.string()),
        rulesetVersion: v.string(),
      }),
    ),
    actions: v.array(
      v.object({
        type: v.string(),
        title: v.string(),
        detail: v.string(),
        deadline: v.optional(v.number()),
        deadlineBasis: v.optional(v.string()),
        draftLetter: v.optional(v.string()),
        handoffTo: v.optional(v.string()),
        handoffContact: v.optional(v.string()),
      }),
    ),
    issues: v.array(v.string()),
    clientSummary: v.string(),
    adviserSummary: v.string(),
    caseNote: v.string(),
    adviserFlags: v.array(v.string()),
    safeguarding: v.optional(v.string()),
    urgent: v.boolean(),
    meta: v.any(),
  },
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.caseId);
    if (!c || c.status !== 'draft') return;
    await replaceChildren(ctx, a.caseId);
    for (const e of a.eligibility) await ctx.db.insert('eligibility', { caseId: a.caseId, ...e });
    for (const act of a.actions) await ctx.db.insert('actions', { caseId: a.caseId, ...act, status: 'todo' });
    await ctx.db.patch(a.caseId, {
      issues: a.issues,
      clientSummary: a.clientSummary,
      adviserSummary: a.adviserSummary,
      caseNote: a.caseNote,
      adviserFlags: a.adviserFlags,
      safeguardingFlag: c.safeguardingFlag ?? a.safeguarding,
      urgency: c.urgency === 'urgent' || a.urgent || a.safeguarding ? 'urgent' : 'standard',
      assessedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await audit(ctx, { caseId: a.caseId, actor: 'ai:intake.assess', event: 'assessed', detail: a.meta });
  },
});

async function replaceChildren(ctx: MutationCtx, caseId: Id<'cases'>) {
  for (const table of ['eligibility', 'actions'] as const) {
    const rows = await ctx.db.query(table).withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(50);
    for (const r of rows) await ctx.db.delete(r._id);
  }
}
