import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { LAWYER_ROLES, audit, requireStaff } from './lib/auth';
import { reviewAction } from './lib/remedySchema';
import { matterDocuments, matterRef } from './matters';
import { recomputeTraction } from './traction';

/** Remedy lawyer review (mvp2.md §6.4). Mirrors adviser.ts in MVP 1. */

const OPEN = ['in_review', 'awaiting_client'] as const;
const DONE = ['lawyer_checked', 'referral_suggested', 'closed'] as const;

export const queue = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireStaff(ctx, token, LAWYER_ROLES);
    const open: Doc<'matters'>[] = [];
    for (const status of OPEN) {
      open.push(...(await ctx.db.query('matters').withIndex('by_status', (q) => q.eq('status', status)).take(100)));
    }
    // Waiting on the lawyer first, then by urgency, then oldest first.
    open.sort((a, b) =>
      a.status !== b.status
        ? a.status === 'in_review' ? -1 : 1
        : a.urgency !== b.urgency
          ? a.urgency === 'high' ? -1 : 1
          : a.createdAt - b.createdAt,
    );
    const recent: Doc<'matters'>[] = [];
    for (const status of DONE) {
      recent.push(...(await ctx.db.query('matters').withIndex('by_status', (q) => q.eq('status', status)).order('desc').take(10)));
    }
    recent.sort((a, b) => b.updatedAt - a.updatedAt);

    const row = async (m: Doc<'matters'>) => {
      const business = await ctx.db.get(m.businessId);
      const summary = await ctx.db.query('matterSummaries').withIndex('by_matterId', (q) => q.eq('matterId', m._id)).order('desc').first();
      return {
        _id: m._id,
        ref: matterRef(m._id),
        business: business ? `${business.name} · ${business.sector} · ${business.headcount} staff` : 'Business',
        question: m.question,
        topic: m.topic,
        urgency: m.urgency,
        status: m.status,
        flagCodes: m.flags.map((f) => f.code),
        lines: [
          m.question.slice(0, 140),
          summary?.unknowns[0] ? `Unknown: ${summary.unknowns[0]}` : (m.flags[0]?.reason ?? ''),
          summary?.questionsForLawyer[0] ?? m.flags[0]?.questionForLawyer ?? '',
        ].filter(Boolean),
        assigned: !!m.assignedStaffId,
        createdAt: m.createdAt,
        dueAt: m.dueAt,
        updatedAt: m.updatedAt,
      };
    };
    return { open: await Promise.all(open.map(row)), recent: await Promise.all(recent.slice(0, 10).map(row)) };
  },
});

export const getMatter = query({
  args: { token: v.string(), matterId: v.id('matters') },
  handler: async (ctx, { token, matterId }) => {
    await requireStaff(ctx, token, LAWYER_ROLES);
    const m = await ctx.db.get(matterId);
    if (!m || m.status === 'answering') return null;
    const business = await ctx.db.get(m.businessId);
    if (!business) return null;
    const [answer, summary, reviews, messages, log, traction, documents] = await Promise.all([
      ctx.db.query('aiAnswers').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').first(),
      ctx.db.query('matterSummaries').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').first(),
      ctx.db.query('reviews').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(30),
      ctx.db.query('matterMessages').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(50),
      ctx.db.query('auditLog').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').take(40),
      ctx.db.query('tractionScores').withIndex('by_businessId', (q) => q.eq('businessId', m.businessId)).unique(),
      matterDocuments(ctx, matterId),
    ]);
    const names: Record<string, string> = {};
    const nameOf = async (id?: Id<'staff'>) => {
      if (!id) return undefined;
      if (!names[id]) names[id] = (await ctx.db.get(id))?.name ?? 'Lawyer';
      return names[id];
    };
    const citations = answer
      ? await Promise.all(
          answer.citations.map(async (c) => {
            const chunk = await ctx.db.get(c.chunkId);
            return { ...c, heading: chunk?.heading ?? '', excerpt: chunk?.text.slice(0, 600) ?? '', source: chunk?.source, versionDate: chunk?.versionDate };
          }),
        )
      : [];
    return {
      _id: m._id,
      ref: matterRef(m._id),
      question: m.question,
      topic: m.topic,
      urgency: m.urgency,
      status: m.status,
      flags: m.flags,
      createdAt: m.createdAt,
      dueAt: m.dueAt,
      finalAnswer: m.finalAnswer,
      checkedBy: await nameOf(m.checkedByStaffId),
      assignedTo: await nameOf(m.assignedStaffId),
      business: {
        name: business.name,
        companyNumber: business.companyNumber,
        sector: business.sector,
        headcount: business.headcount,
        stage: business.stage,
        plan: business.plan,
        traction: traction?.score ?? 0,
      },
      draft: answer ? { answer: answer.answer, citations, confidence: answer.confidence, nextStep: answer.nextStep, model: answer.model } : null,
      summary: summary
        ? { facts: summary.facts, unknowns: summary.unknowns, questionsForLawyer: summary.questionsForLawyer, replyOptions: summary.replyOptions, createdAt: summary.createdAt }
        : null,
      documents,
      messages: await Promise.all(messages.map(async (x) => ({ _id: x._id, from: x.from, text: x.text, at: x.at, name: await nameOf(x.staffId) }))),
      reviews: await Promise.all(
        reviews.map(async (r) => ({
          _id: r._id,
          action: r.action,
          by: await nameOf(r.staffId),
          privateNote: r.privateNote,
          shareableNote: r.shareableNote,
          at: r.at,
        })),
      ),
      log: log.map((l) => ({ _id: l._id, actor: l.actor, event: l.event, at: l.at })),
    };
  },
});

/** Opening a matter assigns it to this lawyer (if unassigned) and logs the view. */
export const open = mutation({
  args: { token: v.string(), matterId: v.id('matters') },
  handler: async (ctx, { token, matterId }) => {
    const staff = await requireStaff(ctx, token, LAWYER_ROLES);
    const m = await ctx.db.get(matterId);
    if (!m) return;
    if (!m.assignedStaffId && (m.status === 'in_review' || m.status === 'awaiting_client')) {
      await ctx.db.patch(matterId, { assignedStaffId: staff._id, updatedAt: Date.now() });
    }
    await audit(ctx, { matterId, actor: `staff:${staff._id}`, event: 'matter_opened' });
  },
});

export const review = mutation({
  args: {
    token: v.string(),
    matterId: v.id('matters'),
    action: reviewAction,
    finalAnswer: v.optional(v.string()),
    messageToClient: v.optional(v.string()),
    privateNote: v.optional(v.string()),
    shareableNote: v.optional(v.string()),
  },
  handler: async (ctx, { token, matterId, action, ...input }) => {
    const staff = await requireStaff(ctx, token, LAWYER_ROLES);
    const m = await ctx.db.get(matterId);
    if (!m) throw new ConvexError('Matter not found.');
    if (m.status === 'answering') throw new ConvexError('The AI is still drafting this answer.');
    const draft = await ctx.db.query('aiAnswers').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).order('desc').first();
    const clip = (s: string | undefined, max: number) => (s?.trim() ? s.trim().slice(0, max) : undefined);
    const finalAnswer = clip(input.finalAnswer, 6000);
    const messageToClient = clip(input.messageToClient, 2000);
    const privateNote = clip(input.privateNote, 3000);
    const shareableNote = clip(input.shareableNote, 3000);
    const now = Date.now();

    let answerToSend: string | undefined;
    if (action === 'approve') {
      answerToSend = finalAnswer ?? draft?.answer;
      if (!answerToSend) throw new ConvexError('There is no AI draft to approve. Write the answer and use Edit and approve.');
    } else if (action === 'edit_approve') {
      if (!finalAnswer) throw new ConvexError('Please write the answer to send.');
      answerToSend = finalAnswer;
    } else if (action === 'request_info') {
      if (!messageToClient) throw new ConvexError('Please write what you need from the client.');
    } else if (action === 'recommend_firm') {
      answerToSend = finalAnswer;
    }

    await ctx.db.insert('reviews', {
      matterId,
      staffId: staff._id,
      action,
      finalAnswer: answerToSend,
      messageToClient,
      privateNote,
      shareableNote,
      at: now,
    });
    if (messageToClient) await ctx.db.insert('matterMessages', { matterId, from: 'lawyer', staffId: staff._id, text: messageToClient, at: now });

    const patch: Partial<Doc<'matters'>> = { updatedAt: now, assignedStaffId: m.assignedStaffId ?? staff._id };
    if (action === 'approve' || action === 'edit_approve') {
      Object.assign(patch, { status: 'lawyer_checked', finalAnswer: answerToSend, checkedByStaffId: staff._id, checkedAt: now });
    } else if (action === 'request_info') {
      patch.status = 'awaiting_client';
    } else {
      Object.assign(patch, { status: 'referral_suggested' });
      if (answerToSend) Object.assign(patch, { finalAnswer: answerToSend, checkedByStaffId: staff._id, checkedAt: now });
    }
    await ctx.db.patch(matterId, patch);
    await audit(ctx, {
      matterId,
      actor: `staff:${staff._id}`,
      event: `review_${action}`,
      detail: {
        // Edit rate is a pilot metric: both the AI draft and the final answer are kept.
        edited: answerToSend !== undefined && draft ? answerToSend !== draft.answer : undefined,
        hasPrivateNote: !!privateNote,
        hasShareableNote: !!shareableNote,
      },
    });
    await recomputeTraction(ctx, m.businessId);
  },
});
