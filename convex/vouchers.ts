import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { requireClient } from './lib/auth';
import { DEMO_FOOD_VALID_DAYS, DEMO_FUEL_VALID_DAYS } from './lib/demoValues';
import { demoVoucherValue, type SchemeId } from './lib/schemes';

const DAY = 24 * 60 * 60 * 1000;
export const FOOD_RETAILERS = ['Tesco', 'Asda', 'Sainsbury’s', 'Aldi', 'Lidl', 'Morrisons', 'Co-op'];

function digits(n: number) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join('');
}

/** Issues the demo voucher for an approved referral. Only called by the adviser approval. */
export async function issueVoucherForReferral(ctx: MutationCtx, referral: Doc<'referrals'>, c: Doc<'cases'>) {
  const scheme = referral.scheme as SchemeId;
  if (scheme !== 'food_bank_referral' && scheme !== 'fuel_support') return null;
  const existing = await ctx.db.query('vouchers').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10);
  const found = existing.find((x) => x.referralId === referral._id);
  if (found) return found._id;

  const now = Date.now();
  const food = scheme === 'food_bank_referral';
  const retailer = food ? (FOOD_RETAILERS.includes(c.retailer ?? '') ? c.retailer! : 'Tesco') : 'Prepayment meter top-up';
  return await ctx.db.insert('vouchers', {
    clientId: c.clientId,
    caseId: c._id,
    referralId: referral._id,
    kind: food ? 'food' : 'fuel',
    retailer,
    valuePence: demoVoucherValue(scheme, c.facts),
    code: food ? `6340${digits(12)}` : `9826${digits(16)}`,
    pin: digits(4),
    issuedAt: now,
    expiresAt: now + (food ? DEMO_FOOD_VALID_DAYS : DEMO_FUEL_VALID_DAYS) * DAY,
  });
}

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const client = await requireClient(ctx, token);
    return await ctx.db
      .query('vouchers')
      .withIndex('by_clientId', (q) => q.eq('clientId', client._id))
      .order('desc')
      .take(50);
  },
});

export const get = query({
  args: { token: v.string(), voucherId: v.id('vouchers') },
  handler: async (ctx, { token, voucherId }) => {
    const client = await requireClient(ctx, token);
    const voucher = await ctx.db.get(voucherId);
    return voucher && voucher.clientId === client._id ? voucher : null;
  },
});

export const setUsed = mutation({
  args: { token: v.string(), voucherId: v.id('vouchers'), used: v.boolean() },
  handler: async (ctx, { token, voucherId, used }) => {
    const client = await requireClient(ctx, token);
    const voucher = await ctx.db.get(voucherId);
    if (!voucher || voucher.clientId !== client._id) throw new ConvexError('Voucher not found.');
    await ctx.db.patch(voucherId, { usedAt: used ? Date.now() : undefined });
  },
});
