import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';

const DAY = 24 * 60 * 60 * 1000;
export const FOOD_RETAILERS = ['Tesco', 'Asda', 'Sainsbury’s', 'Aldi', 'Lidl', 'Morrisons', 'Co-op'];

function digits(n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Issues the vouchers for an eligible assessment. Safe to call twice. */
export const claim = mutation({
  args: { userId: v.id('users'), assessmentId: v.id('assessments'), retailer: v.string() },
  handler: async (ctx, { userId, assessmentId, retailer }) => {
    const assessment = await ctx.db.get(assessmentId);
    if (!assessment || assessment.userId !== userId) throw new ConvexError('We couldn’t find that check.');
    if (!assessment.decision.eligible) throw new ConvexError('This check didn’t qualify for a voucher.');
    if (!FOOD_RETAILERS.includes(retailer)) throw new ConvexError('Please choose a supermarket.');

    const existing = await ctx.db
      .query('vouchers')
      .withIndex('by_assessment', (q) => q.eq('assessmentId', assessmentId))
      .collect();
    if (existing.length) return existing.find((x) => x.kind === 'food')?._id ?? existing[0]._id;

    const now = Date.now();
    const foodId = await ctx.db.insert('vouchers', {
      userId,
      assessmentId,
      kind: 'food',
      retailer,
      valuePence: assessment.decision.foodValuePence,
      code: `6340${digits(12)}`,
      pin: digits(4),
      issuedAt: now,
      expiresAt: now + 30 * DAY,
    });

    if (assessment.decision.fuelValuePence > 0) {
      await ctx.db.insert('vouchers', {
        userId,
        assessmentId,
        kind: 'fuel',
        retailer: 'Prepayment meter top-up',
        valuePence: assessment.decision.fuelValuePence,
        code: `9826${digits(16)}`,
        pin: digits(4),
        issuedAt: now,
        expiresAt: now + 90 * DAY,
      });
    }
    return foodId;
  },
});

export const list = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query('vouchers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return all;
  },
});

export const get = query({
  args: { userId: v.id('users'), voucherId: v.id('vouchers') },
  handler: async (ctx, { userId, voucherId }) => {
    const voucher = await ctx.db.get(voucherId);
    if (!voucher || voucher.userId !== userId) return null;
    return voucher;
  },
});

export const setUsed = mutation({
  args: { userId: v.id('users'), voucherId: v.id('vouchers'), used: v.boolean() },
  handler: async (ctx, { userId, voucherId, used }) => {
    const voucher = await ctx.db.get(voucherId);
    if (!voucher || voucher.userId !== userId) throw new ConvexError('Voucher not found.');
    await ctx.db.patch(voucherId, { usedAt: used ? Date.now() : undefined });
  },
});

/** Demo helper: wipes this person's checks and vouchers so the flow can be shown again. */
export const resetDemo = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    for (const table of ['vouchers', 'assessments'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
  },
});
