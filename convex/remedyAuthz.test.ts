/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const profile = { companyNumber: undefined, sector: 'creative', headcount: 3, stage: 'trading' as const, region: 'england_wales' as const, consent: true };

async function setup() {
  const t = convexTest(schema, modules);
  const a = await t.mutation(api.business.start, { ...profile, name: 'Jade Studio Ltd' });
  const b = await t.mutation(api.business.start, { ...profile, name: 'Other Co' });
  const matterId = await t.run(async (ctx) => {
    const biz = await ctx.db.query('businesses').first();
    return await ctx.db.insert('matters', {
      businessId: biz!._id,
      question: 'Can I take on a freelancer?',
      topic: 'employment',
      urgency: 'standard',
      status: 'in_review',
      flags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return { t, a, b, matterId };
}

describe('authorisation', () => {
  test('a business cannot read or reply to another business’s matter', async () => {
    const { t, a, b, matterId } = await setup();
    await expect(t.query(api.matters.get, { token: a, matterId })).resolves.toMatchObject({ question: 'Can I take on a freelancer?' });
    await expect(t.query(api.matters.get, { token: b, matterId })).rejects.toThrow(/couldn’t find/);
    await expect(t.mutation(api.matters.reply, { token: b, matterId, text: 'hi' })).rejects.toThrow(/couldn’t find/);
    await expect(t.query(api.matters.mine, { token: b })).resolves.toEqual([]);
  });

  test('only lawyers see the review queue', async () => {
    const { t, a } = await setup();
    await expect(t.query(api.lawyer.queue, { token: a })).rejects.toThrow(/sign in/);
    const adviser = await t.mutation(api.sessions.staffSignIn, { name: 'Priya', organisation: 'CA', code: 'LEEDS' });
    await expect(t.query(api.lawyer.queue, { token: adviser })).rejects.toThrow(/Remedy lawyer/);
    const lawyer = await t.mutation(api.sessions.remedyStaffSignIn, { name: 'A. Lawyer', code: 'REMEDY', role: 'lawyer' });
    const q = await t.query(api.lawyer.queue, { token: lawyer });
    expect(q.open).toHaveLength(1);
    await expect(t.query(api.adviser.queue, { token: lawyer })).rejects.toThrow(/adviser/);
  });

  test('a firm cannot read another firm’s referral; private notes never reach the firm', async () => {
    const { t, a, matterId } = await setup();
    const { firm1, firm2 } = await t.run(async (ctx) => {
      const mk = (name: string) => ctx.db.insert('partnerFirms', { name, licence: 'anchor', sectors: ['any'], city: 'Leeds', blurb: '', active: true });
      return { firm1: await mk('Firm One'), firm2: await mk('Firm Two') };
    });
    const lawyer = await t.mutation(api.sessions.remedyStaffSignIn, { name: 'A. Lawyer', code: 'REMEDY', role: 'lawyer' });
    await t.mutation(api.lawyer.review, {
      token: lawyer,
      matterId,
      action: 'recommend_firm',
      privateNote: 'SECRET internal view',
      shareableNote: 'Needs a full status review.',
    });
    const referralId = await t.mutation(api.firms.createReferral, {
      token: a,
      firmId: firm1,
      matterIds: [matterId],
      documentIds: [],
      consent: { profile: true, matters: true, documents: false },
    });
    const u1 = await t.mutation(api.sessions.remedyStaffSignIn, { name: 'F1', code: 'REMEDY', role: 'firm', firmId: firm1 });
    const u2 = await t.mutation(api.sessions.remedyStaffSignIn, { name: 'F2', code: 'REMEDY', role: 'firm', firmId: firm2 });
    const pack = await t.query(api.firms.getReferral, { token: u1, referralId });
    expect(pack.matters[0].notes.map((n) => n.text)).toEqual(['Needs a full status review.']);
    expect(JSON.stringify(pack)).not.toContain('SECRET');
    await expect(t.query(api.firms.getReferral, { token: u2, referralId })).rejects.toThrow(/couldn’t find/);
    await expect(t.mutation(api.firms.respond, { token: u2, referralId, decision: 'accept', contact: 'x' })).rejects.toThrow();
    expect((await t.query(api.firms.inbox, { token: u2 })).referrals).toEqual([]);
    await t.mutation(api.firms.respond, { token: u1, referralId, decision: 'accept', contact: 'Sam Patel' });
    const s = await t.query(api.firms.suggestions, { token: a });
    expect(s.referrals[0]).toMatchObject({ status: 'accepted', firmContact: 'Sam Patel' });
  });

  test('a business cannot share another business’s matter with a firm', async () => {
    const { t, b, matterId } = await setup();
    const firm = await t.run((ctx) => ctx.db.insert('partnerFirms', { name: 'F', licence: 'anchor', sectors: ['any'], city: 'Leeds', blurb: '', active: true }));
    // Give business B its own lawyer recommendation so a firm is suggested to it.
    await t.run(async (ctx) => {
      const other = (await ctx.db.query('businesses').collect()).find((x) => x.name === 'Other Co')!;
      await ctx.db.insert('matters', { businessId: other._id, question: 'Lease dispute', topic: 'property', urgency: 'standard', status: 'referral_suggested', flags: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    await expect(
      t.mutation(api.firms.createReferral, { token: b, firmId: firm, matterIds: [matterId], documentIds: [], consent: { profile: true, matters: true, documents: false } }),
    ).rejects.toThrow(/couldn’t find/);
  });
});
