import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { deleteDraftsFor } from './drafting';
import { audit, getBusiness, newToken, requireBusiness, sha256 } from './lib/auth';
import { businessStage } from './lib/remedySchema';
import { TRACTION_THRESHOLD } from './lib/traction';
import { recomputeTraction } from './traction';

/** Business client profile (mvp2.md §4.1). Demo identity: hashed session token. */

export const BUSINESS_CONSENT_VERSION = '2026-11-13-remedy';
export const SECTORS = ['creative', 'tech', 'retail', 'hospitality', 'professional', 'construction', 'health', 'other'] as const;

const profileFields = {
  name: v.string(),
  companyNumber: v.optional(v.string()),
  sector: v.string(),
  headcount: v.number(),
  stage: businessStage,
};

function cleanProfile(p: { name: string; companyNumber?: string; sector: string; headcount: number }) {
  const name = p.name.trim().slice(0, 120);
  if (!name) throw new ConvexError('Please enter your business name.');
  const companyNumber = p.companyNumber?.trim().toUpperCase().replace(/\s+/g, '') || undefined;
  if (companyNumber && !/^[A-Z0-9]{8}$/.test(companyNumber)) throw new ConvexError('A company number has 8 characters, e.g. 12345678 or SC123456.');
  if (!(SECTORS as readonly string[]).includes(p.sector)) throw new ConvexError('Please choose a sector.');
  if (!Number.isFinite(p.headcount) || p.headcount < 0 || p.headcount > 10000) throw new ConvexError('Please enter how many people work in the business.');
  return { name, companyNumber, sector: p.sector, headcount: Math.round(p.headcount) };
}

export const start = mutation({
  args: { ...profileFields, region: v.literal('england_wales'), consent: v.boolean() },
  handler: async (ctx, { consent, region, stage, ...profile }) => {
    if (!consent) throw new ConvexError('Please agree to the privacy notice to continue.');
    const clean = cleanProfile(profile);
    const token = newToken();
    const now = Date.now();
    const businessId = await ctx.db.insert('businesses', {
      sessionHash: await sha256(token),
      ...clean,
      initialHeadcount: clean.headcount,
      stage,
      region,
      plan: 'starter',
      consentAt: now,
      consentVersion: BUSINESS_CONSENT_VERSION,
      createdAt: now,
    });
    await audit(ctx, { actor: 'client', event: 'business_started', detail: { businessId, consentVersion: BUSINESS_CONSENT_VERSION } });
    await recomputeTraction(ctx, businessId);
    return token;
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const b = await getBusiness(ctx, token);
    if (!b) return null;
    const traction = await ctx.db.query('tractionScores').withIndex('by_businessId', (q) => q.eq('businessId', b._id)).unique();
    return {
      name: b.name,
      companyNumber: b.companyNumber,
      sector: b.sector,
      headcount: b.headcount,
      stage: b.stage,
      plan: b.plan,
      region: b.region,
      createdAt: b.createdAt,
      traction: traction ? { score: traction.score, signals: traction.signals, threshold: TRACTION_THRESHOLD } : null,
    };
  },
});

export const updateProfile = mutation({
  args: { token: v.string(), ...profileFields },
  handler: async (ctx, { token, stage, ...profile }) => {
    const b = await requireBusiness(ctx, token);
    const clean = cleanProfile(profile);
    await ctx.db.patch(b._id, { ...clean, stage });
    await audit(ctx, {
      actor: 'client',
      event: 'business_profile_updated',
      detail: { businessId: b._id, stage: stage !== b.stage ? { from: b.stage, to: stage } : undefined, headcount: clean.headcount },
    });
    await recomputeTraction(ctx, b._id);
  },
});

/** Deletes the business and everything linked to it, including uploaded files. */
export const deleteMyData = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const b = await requireBusiness(ctx, token);
    await deleteDraftsFor(ctx, { businessId: b._id });
    const matters = await ctx.db.query('matters').withIndex('by_businessId', (q) => q.eq('businessId', b._id)).take(200);
    for (const m of matters) {
      const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', m._id)).take(50);
      for (const d of docs) {
        await ctx.storage.delete(d.storageId);
        await ctx.db.delete(d._id);
      }
      for (const table of ['aiAnswers', 'matterSummaries', 'reviews', 'matterMessages', 'auditLog'] as const) {
        const rows = await ctx.db.query(table).withIndex('by_matterId', (q) => q.eq('matterId', m._id)).take(500);
        for (const r of rows) await ctx.db.delete(r._id);
      }
      await ctx.db.delete(m._id);
    }
    const referrals = await ctx.db.query('firmReferrals').withIndex('by_businessId', (q) => q.eq('businessId', b._id)).take(100);
    for (const r of referrals) await ctx.db.delete(r._id);
    const scores = await ctx.db.query('tractionScores').withIndex('by_businessId', (q) => q.eq('businessId', b._id)).take(5);
    for (const s of scores) await ctx.db.delete(s._id);
    await ctx.db.delete(b._id);
    await audit(ctx, { actor: 'system', event: 'business_data_deleted', detail: { matters: matters.length, referrals: referrals.length } });
  },
});
