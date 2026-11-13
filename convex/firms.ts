import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server';
import { FIRM_ROLES, audit, requireBusiness, requireFirmReferral, requireStaff } from './lib/auth';
import { TRACTION_THRESHOLD } from './lib/traction';
import { clausesOf, matterRef } from './matters';

/** Partner-firm suggestion, consented handoff and the firm inbox (mvp2.md §6.5). */

export const FEES_PENCE = { submission: 100_00, seed_ready: 750_00 } as const;
const DOC_LABEL: Record<string, string> = {
  contract: 'Contract',
  term_sheet: 'Term sheet',
  shareholders_agreement: 'Shareholders’ agreement',
  lease: 'Lease',
  other: 'Document',
};

type Trigger = { trigger: Doc<'firmReferrals'>['trigger']; reason: string };

/** Decides, server side, whether and why a firm should be suggested. */
async function currentTrigger(ctx: QueryCtx, business: Doc<'businesses'>): Promise<Trigger | null> {
  const matters = await ctx.db.query('matters').withIndex('by_businessId', (q) => q.eq('businessId', business._id)).order('desc').take(100);
  const reserved = matters.find((m) => m.status !== 'closed' && m.flags.some((f) => f.code === 'RESERVED_ACTIVITY'));
  if (reserved) {
    return { trigger: 'reserved_activity', reason: `“${reserved.question.slice(0, 80)}” may need work only an authorised law firm can do (for example court proceedings).` };
  }
  const recommended = matters.find((m) => m.status === 'referral_suggested');
  if (recommended) {
    return { trigger: 'lawyer', reason: `Our lawyer recommends a partner firm for “${recommended.question.slice(0, 80)}”.` };
  }
  const traction = await ctx.db.query('tractionScores').withIndex('by_businessId', (q) => q.eq('businessId', business._id)).unique();
  if (traction && traction.score >= TRACTION_THRESHOLD) {
    return {
      trigger: 'traction',
      reason: `${business.name} is growing (${traction.signals.map((s) => s.signal.toLowerCase()).join(', ')}). A partner firm can take on the bigger legal work that comes with that.`,
    };
  }
  return null;
}

async function matchFirms(ctx: QueryCtx, sector: string) {
  const firms = await ctx.db.query('partnerFirms').take(50);
  return firms
    .filter((f) => f.active && (f.sectors.includes(sector) || f.sectors.includes('any')))
    .sort((a, b) => (a.licence === b.licence ? (a.sectors.includes(sector) ? -1 : 1) : a.licence === 'anchor' ? -1 : 1))
    .slice(0, 3);
}

async function businessDocuments(ctx: QueryCtx, matters: Doc<'matters'>[]) {
  const out: (Doc<'documents'> & { matterId: Id<'matters'> })[] = [];
  for (const m of matters) {
    const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', m._id)).take(20);
    for (const d of docs) if (d.matterId) out.push(d as Doc<'documents'> & { matterId: Id<'matters'> });
  }
  return out;
}

/** Public list of panel firm names, for the demo firm sign-in. */
export const panel = query({
  args: {},
  handler: async (ctx) => {
    const firms = await ctx.db.query('partnerFirms').take(50);
    return firms.filter((f) => f.active).map((f) => ({ _id: f._id, name: f.name, licence: f.licence, city: f.city }));
  },
});

export const suggestions = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const business = await requireBusiness(ctx, token);
    const referralsRaw = await ctx.db.query('firmReferrals').withIndex('by_businessId', (q) => q.eq('businessId', business._id)).order('desc').take(20);
    const referrals = await Promise.all(
      referralsRaw.map(async (r) => ({
        _id: r._id,
        firm: (await ctx.db.get(r.firmId))?.name ?? 'Partner firm',
        status: r.status,
        firmContact: r.firmContact,
        declineReason: r.declineReason,
        createdAt: r.createdAt,
        respondedAt: r.respondedAt,
        matters: r.matterIds.length,
        documents: r.documentIds.length,
      })),
    );
    const trigger = await currentTrigger(ctx, business);
    const matters = await ctx.db.query('matters').withIndex('by_businessId', (q) => q.eq('businessId', business._id)).order('desc').take(30);
    const docs = await businessDocuments(ctx, matters);
    const firms = trigger ? await matchFirms(ctx, business.sector) : [];
    return {
      trigger,
      firms: firms.map((f) => ({ _id: f._id, name: f.name, licence: f.licence, city: f.city, blurb: f.blurb, sectors: f.sectors })),
      fees: FEES_PENCE,
      feeType: trigger?.trigger === 'traction' && business.stage === 'raising' ? 'seed_ready' : 'submission',
      matters: matters
        .filter((m) => m.status !== 'answering')
        .map((m) => ({ _id: m._id, ref: matterRef(m._id), question: m.question, status: m.status })),
      documents: docs.map((d) => ({ _id: d._id, matterId: d.matterId, kind: d.kind, label: DOC_LABEL[d.kind] ?? 'Document', summary: d.summary })),
      referrals,
    };
  },
});

export const createReferral = mutation({
  args: {
    token: v.string(),
    firmId: v.id('partnerFirms'),
    matterIds: v.array(v.id('matters')),
    documentIds: v.array(v.id('documents')),
    consent: v.object({ profile: v.boolean(), matters: v.boolean(), documents: v.boolean() }),
  },
  handler: async (ctx, { token, firmId, matterIds, documentIds, consent }) => {
    const business = await requireBusiness(ctx, token);
    const trigger = await currentTrigger(ctx, business);
    if (!trigger) throw new ConvexError('A partner firm isn’t suggested for your business yet.');
    const firms = await matchFirms(ctx, business.sector);
    if (!firms.some((f) => f._id === firmId)) throw new ConvexError('Please choose one of the suggested firms.');
    if (!consent.profile && !consent.matters && !consent.documents) throw new ConvexError('Please tick at least one thing to share.');
    const existing = await ctx.db.query('firmReferrals').withIndex('by_businessId', (q) => q.eq('businessId', business._id)).take(50);
    if (existing.some((r) => r.firmId === firmId && r.status !== 'declined')) throw new ConvexError('You’ve already sent a pack to this firm.');

    // Only consented items are copied into the pack, and only the client's own.
    const sharedMatters: Id<'matters'>[] = [];
    if (consent.matters) {
      for (const id of [...new Set(matterIds)].slice(0, 20)) {
        const m = await ctx.db.get(id);
        if (!m || m.businessId !== business._id) throw new ConvexError('We couldn’t find one of those matters.');
        sharedMatters.push(id);
      }
      if (!sharedMatters.length) throw new ConvexError('Choose which matters to share, or untick “Matters”.');
    }
    const sharedDocs: Id<'documents'>[] = [];
    if (consent.documents) {
      for (const id of [...new Set(documentIds)].slice(0, 20)) {
        const d = await ctx.db.get(id);
        const m = d?.matterId ? await ctx.db.get(d.matterId) : null;
        if (!d || !m || m.businessId !== business._id) throw new ConvexError('We couldn’t find one of those documents.');
        sharedDocs.push(id);
      }
      if (!sharedDocs.length) throw new ConvexError('Choose which documents to share, or untick “Documents”.');
    }
    const feeType = trigger.trigger === 'traction' && business.stage === 'raising' ? 'seed_ready' : 'submission';
    const now = Date.now();
    const referralId = await ctx.db.insert('firmReferrals', {
      businessId: business._id,
      firmId,
      matterIds: sharedMatters,
      documentIds: sharedDocs,
      reason: trigger.reason,
      trigger: trigger.trigger,
      consent: { ...consent, at: now },
      feeType,
      feePence: FEES_PENCE[feeType],
      status: 'sent',
      createdAt: now,
    });
    await audit(ctx, {
      actor: 'client',
      event: 'firm_referral_sent',
      detail: { referralId, firmId, trigger: trigger.trigger, consent, matters: sharedMatters.length, documents: sharedDocs.length, feeType },
    });
    for (const matterId of sharedMatters) await audit(ctx, { matterId, actor: 'client', event: 'shared_with_firm', detail: { referralId, firmId } });
    return referralId;
  },
});

// ---------- Firm side ----------

export const inbox = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const staff = await requireStaff(ctx, token, FIRM_ROLES);
    if (!staff.firmId) return { firm: null, referrals: [] };
    const firm = await ctx.db.get(staff.firmId);
    const rows = await ctx.db.query('firmReferrals').withIndex('by_firmId', (q) => q.eq('firmId', staff.firmId!)).order('desc').take(50);
    return {
      firm: firm ? { name: firm.name, licence: firm.licence } : null,
      referrals: await Promise.all(
        rows.map(async (r) => {
          const b = r.consent.profile ? await ctx.db.get(r.businessId) : null;
          return {
            _id: r._id,
            business: b ? `${b.name} · ${b.sector} · ${b.stage}` : 'A Remedy client (profile not shared)',
            reason: r.reason,
            trigger: r.trigger,
            matters: r.matterIds.length,
            documents: r.documentIds.length,
            status: r.status,
            feeType: r.feeType,
            createdAt: r.createdAt,
          };
        }),
      ),
    };
  },
});

export const getReferral = query({
  args: { token: v.string(), referralId: v.id('firmReferrals') },
  handler: async (ctx, { token, referralId }) => {
    const { referral: r } = await requireFirmReferral(ctx, token, referralId);
    const b = r.consent.profile ? await ctx.db.get(r.businessId) : null;
    const matters = [];
    for (const id of r.consent.matters ? r.matterIds : []) {
      const m = await ctx.db.get(id);
      if (!m) continue;
      const reviews = await ctx.db.query('reviews').withIndex('by_matterId', (q) => q.eq('matterId', id)).take(30);
      const draft = m.finalAnswer ? null : await ctx.db.query('aiAnswers').withIndex('by_matterId', (q) => q.eq('matterId', id)).order('desc').first();
      matters.push({
        _id: m._id,
        ref: matterRef(m._id),
        question: m.question,
        topic: m.topic,
        status: m.status,
        flags: m.flags.map((f) => ({ code: f.code, reason: f.reason })),
        answer: m.finalAnswer ?? draft?.answer,
        answerChecked: !!m.finalAnswer,
        // Shareable notes only. Private notes never leave Remedy.
        notes: reviews.filter((x) => x.shareableNote).map((x) => ({ text: x.shareableNote!, at: x.at })),
      });
    }
    const documents = [];
    for (const id of r.consent.documents ? r.documentIds : []) {
      const d = await ctx.db.get(id);
      if (!d) continue;
      documents.push({ _id: d._id, label: DOC_LABEL[d.kind] ?? 'Document', summary: d.summary, clauses: clausesOf(d), url: await ctx.storage.getUrl(d.storageId) });
    }
    return {
      _id: r._id,
      status: r.status,
      reason: r.reason,
      trigger: r.trigger,
      feeType: r.feeType,
      feePence: r.feePence,
      consent: r.consent,
      firmContact: r.firmContact,
      declineReason: r.declineReason,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      profile: b ? { name: b.name, companyNumber: b.companyNumber, sector: b.sector, headcount: b.headcount, stage: b.stage, region: 'England and Wales' } : null,
      matters,
      documents,
    };
  },
});

export const respond = mutation({
  args: {
    token: v.string(),
    referralId: v.id('firmReferrals'),
    decision: v.union(v.literal('accept'), v.literal('decline')),
    contact: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { token, referralId, decision, contact, reason }) => {
    const { staff, referral } = await requireFirmReferral(ctx, token, referralId);
    if (referral.status !== 'sent') throw new ConvexError('You’ve already responded to this referral.');
    const now = Date.now();
    if (decision === 'accept') {
      if (!contact?.trim()) throw new ConvexError('Please add a contact name for the client.');
      await ctx.db.patch(referralId, { status: 'accepted', firmContact: contact.trim().slice(0, 120), respondedAt: now });
    } else {
      if (!reason?.trim()) throw new ConvexError('Please give a reason for declining.');
      await ctx.db.patch(referralId, { status: 'declined', declineReason: reason.trim().slice(0, 400), respondedAt: now });
    }
    await audit(ctx, { actor: `staff:${staff._id}`, event: `firm_referral_${decision}ed`, detail: { referralId } });
  },
});

/** Demo panel: two Leeds firms plus a national partner. Idempotent. */
export const seedPanel = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('partnerFirms').take(10);
    if (existing.length) return { created: 0 };
    const firms: Omit<Doc<'partnerFirms'>, '_id' | '_creationTime'>[] = [
      {
        name: 'Aire & Calder Solicitors (demo)',
        licence: 'anchor',
        sectors: ['creative', 'tech', 'professional', 'retail'],
        city: 'Leeds',
        blurb: 'Start-up and venture team: seed rounds, shareholders’ agreements, EMI schemes.',
        active: true,
      },
      {
        name: 'Kirkgate Legal LLP (demo)',
        licence: 'partner',
        sectors: ['any'],
        city: 'Leeds',
        blurb: 'Employment, commercial disputes and business premises for SMEs.',
        active: true,
      },
      {
        name: 'Northern Quarter Law (demo)',
        licence: 'partner',
        sectors: ['creative', 'hospitality', 'health'],
        city: 'Manchester',
        blurb: 'IP, brand protection and licensing for creative businesses.',
        active: true,
      },
    ];
    for (const f of firms) await ctx.db.insert('partnerFirms', f);
    return { created: firms.length };
  },
});
