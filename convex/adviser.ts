import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { draftsForCase } from './drafting';
import { sendReferral } from './integrations';
import { audit, requireStaff } from './lib/auth';
import { factChips, type FactKey } from './lib/facts';
import { SCHEME_INFO, type SchemeId } from './lib/schemes';
import { issueVoucherForReferral } from './vouchers';

const OPEN = ['submitted', 'in_review'] as const;
const DONE = ['approved', 'rejected', 'referred'] as const;

/** Queue sorted by urgency, then oldest first. */
export const queue = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireStaff(ctx, token);
    const open: Doc<'cases'>[] = [];
    for (const status of OPEN) {
      open.push(...(await ctx.db.query('cases').withIndex('by_status', (q) => q.eq('status', status)).take(100)));
    }
    open.sort((a, b) => (a.urgency === b.urgency ? (a.submittedAt ?? 0) - (b.submittedAt ?? 0) : a.urgency === 'urgent' ? -1 : 1));

    const recent: Doc<'cases'>[] = [];
    for (const status of DONE) {
      recent.push(...(await ctx.db.query('cases').withIndex('by_status', (q) => q.eq('status', status)).order('desc').take(10)));
    }
    recent.sort((a, b) => b.updatedAt - a.updatedAt);

    const summarise = async (c: Doc<'cases'>) => {
      const eligibility = await ctx.db.query('eligibility').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10);
      const referrals = await ctx.db.query('referrals').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(10);
      return {
        _id: c._id,
        status: c.status,
        urgency: c.urgency,
        safeguarding: !!c.safeguardingFlag,
        adviserSummary: c.adviserSummary ?? c.story.slice(0, 160),
        flags: c.adviserFlags,
        submittedAt: c.submittedAt ?? c.createdAt,
        outcomes: eligibility.map((e) => ({ scheme: e.scheme, name: SCHEME_INFO[e.scheme as SchemeId]?.name ?? e.scheme, outcome: e.outcome })),
        pending: referrals.filter((r) => r.status === 'pending').length,
      };
    };
    return {
      open: await Promise.all(open.map(summarise)),
      recent: await Promise.all(recent.slice(0, 10).map(summarise)),
    };
  },
});

export const getCase = query({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    await requireStaff(ctx, token);
    const c = await ctx.db.get(caseId);
    // Advisers only see a case once the client has sent it.
    if (!c || c.status === 'draft') return null;
    const [documents, eligibility, referrals, actions, log] = await Promise.all([
      ctx.db.query('documents').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(20),
      ctx.db.query('eligibility').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(10),
      ctx.db.query('referrals').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(10),
      ctx.db.query('actions').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(20),
      ctx.db.query('auditLog').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).order('desc').take(40),
    ]);
    const staffIds = [...new Set(referrals.map((r) => r.decidedBy).filter((x): x is Id<'staff'> => !!x))];
    const staffNames: Record<string, string> = {};
    for (const id of staffIds) staffNames[id] = (await ctx.db.get(id))?.name ?? 'Adviser';

    return {
      ...c,
      chips: factChips(c.facts).map((chip) => ({
        ...chip,
        source: c.factSources[chip.key as FactKey] ?? 'client',
        confidence: c.factConfidence[chip.key] ?? 1,
      })),
      documents: await Promise.all(documents.map(async (d) => ({ ...d, url: await ctx.storage.getUrl(d.storageId) }))),
      eligibility: eligibility.map((e) => ({ ...e, info: SCHEME_INFO[e.scheme as SchemeId] })),
      referrals: referrals.map((r) => ({ ...r, info: SCHEME_INFO[r.scheme as SchemeId], decidedByName: r.decidedBy ? staffNames[r.decidedBy] : undefined })),
      actions,
      log: log.map((l) => ({ _id: l._id, actor: l.actor, event: l.event, at: l.at })),
      drafts: await draftsForCase(ctx, caseId),
    };
  },
});

/** Opening a submitted case claims it for this adviser. */
export const open = mutation({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    const staff = await requireStaff(ctx, token);
    const c = await ctx.db.get(caseId);
    if (!c || c.status !== 'submitted') return;
    await ctx.db.patch(caseId, { status: 'in_review', assignedStaffId: staff._id, updatedAt: Date.now() });
    await audit(ctx, { caseId, actor: `staff:${staff._id}`, event: 'review_started' });
  },
});

export const editNote = mutation({
  args: { token: v.string(), caseId: v.id('cases'), caseNote: v.string() },
  handler: async (ctx, { token, caseId, caseNote }) => {
    const staff = await requireStaff(ctx, token);
    const c = await ctx.db.get(caseId);
    if (!c) throw new ConvexError('Case not found.');
    await ctx.db.patch(caseId, { caseNote: caseNote.slice(0, 4000), updatedAt: Date.now() });
    await audit(ctx, { caseId, actor: `staff:${staff._id}`, event: 'case_note_edited', detail: { before: c.caseNote, after: caseNote } });
  },
});

export const requestInfo = mutation({
  args: { token: v.string(), caseId: v.id('cases'), message: v.string() },
  handler: async (ctx, { token, caseId, message }) => {
    const staff = await requireStaff(ctx, token);
    const c = await ctx.db.get(caseId);
    if (!c) throw new ConvexError('Case not found.');
    await ctx.db.patch(caseId, { adviserMessage: message.trim().slice(0, 600), status: 'in_review', updatedAt: Date.now() });
    await audit(ctx, { caseId, actor: `staff:${staff._id}`, event: 'info_requested', detail: { message } });
  },
});

export const decideReferral = mutation({
  args: {
    token: v.string(),
    referralId: v.id('referrals'),
    decision: v.union(v.literal('approve'), v.literal('reject')),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, referralId, decision, reason }) => {
    const staff = await requireStaff(ctx, token);
    const referral = await ctx.db.get(referralId);
    if (!referral) throw new ConvexError('Referral not found.');
    if (referral.status !== 'pending') return;
    const c = await ctx.db.get(referral.caseId);
    if (!c) throw new ConvexError('Case not found.');
    if (decision === 'reject' && !reason?.trim()) throw new ConvexError('Please give a reason for rejecting.');

    const now = Date.now();
    if (decision === 'approve') {
      const sent = sendReferral(referral.scheme, referral.payload);
      await ctx.db.patch(referralId, {
        status: referral.scheme === 'leeds_crisis_payment' ? 'sent' : 'approved',
        decidedBy: staff._id,
        decidedAt: now,
        reason: `${sent.channel} · ref ${sent.reference}`,
      });
      await issueVoucherForReferral(ctx, referral, c);
    } else {
      await ctx.db.patch(referralId, { status: 'rejected', decidedBy: staff._id, decidedAt: now, reason: reason!.trim().slice(0, 400) });
    }
    await audit(ctx, { caseId: c._id, actor: `staff:${staff._id}`, event: `referral_${decision}d`, detail: { scheme: referral.scheme, reason } });
    await settleCase(ctx, c._id, staff._id);
  },
});

/** When every referral is decided, the case is approved (any approved) or rejected. */
async function settleCase(ctx: MutationCtx, caseId: Id<'cases'>, staffId: Id<'staff'>) {
  const referrals = await ctx.db.query('referrals').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(10);
  if (referrals.some((r) => r.status === 'pending')) {
    await ctx.db.patch(caseId, { status: 'in_review', assignedStaffId: staffId, updatedAt: Date.now() });
    return;
  }
  const anyApproved = referrals.some((r) => r.status === 'approved' || r.status === 'sent');
  await ctx.db.patch(caseId, { status: anyApproved ? 'approved' : 'rejected', updatedAt: Date.now() });
}
