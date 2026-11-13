import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { audit } from './lib/auth';
import { TRACTION_THRESHOLD, tractionScore } from './lib/traction';

/** Traction score (mvp2.md §6.5): recalculated on change and nightly. */

export async function recomputeTraction(ctx: MutationCtx, businessId: Id<'businesses'>) {
  const business = await ctx.db.get(businessId);
  if (!business) return null;
  const matters = await ctx.db.query('matters').withIndex('by_businessId', (q) => q.eq('businessId', businessId)).order('desc').take(100);
  const documentKinds: string[] = [];
  for (const m of matters) {
    const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', m._id)).take(20);
    documentKinds.push(...docs.map((d) => d.kind));
  }
  const result = tractionScore({
    stage: business.stage,
    headcount: business.headcount,
    initialHeadcount: business.initialHeadcount,
    documentKinds,
    matters: matters.map((m) => ({ createdAt: m.createdAt, flagCodes: m.flags.map((f) => f.code) })),
    now: Date.now(),
  });
  const existing = await ctx.db.query('tractionScores').withIndex('by_businessId', (q) => q.eq('businessId', businessId)).unique();
  if (existing) {
    if (existing.score !== result.score || existing.signals.length !== result.signals.length) {
      await ctx.db.patch(existing._id, { ...result, computedAt: Date.now() });
    }
  } else {
    await ctx.db.insert('tractionScores', { businessId, ...result, computedAt: Date.now() });
  }
  const before = existing?.score ?? 0;
  if (before < TRACTION_THRESHOLD && result.score >= TRACTION_THRESHOLD) {
    await audit(ctx, { actor: 'system', event: 'traction_threshold_passed', detail: { businessId, score: result.score } });
  }
  return result;
}

export const score = internalMutation({
  args: { businessId: v.id('businesses') },
  handler: async (ctx, { businessId }) => {
    await recomputeTraction(ctx, businessId);
    return null;
  },
});

/** Nightly: rescore every business in batches of 50. */
export const scoreAll = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('businesses').paginate({ numItems: 50, cursor: cursor ?? null });
    for (const b of page.page) await recomputeTraction(ctx, b._id);
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.traction.scoreAll, { cursor: page.continueCursor });
    return null;
  },
});
