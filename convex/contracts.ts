import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, mutation } from './_generated/server';
import { audit, requireBusinessMatter } from './lib/auth';
import { SMART_MODEL, TONE_BUSINESS, geminiJson, obj, str } from './lib/gemini';
import { addFlagAndReview } from './matters';
import { recomputeTraction } from './traction';

/**
 * Contracts and documents attached to a matter (mvp2.md §4.1 upload screen).
 * Reuses the MVP 1 `documents` table and file storage with `matterId` set.
 * The AI highlights clauses; the client sees them before sending to a lawyer.
 */

export const CONTRACT_KINDS = ['contract', 'term_sheet', 'shareholders_agreement', 'lease', 'other'] as const;
const MAX_BYTES = 10 * 1024 * 1024;

const KIND_HINTS: Record<string, string> = {
  contract: 'A commercial contract (e.g. a client, supplier or freelancer agreement).',
  term_sheet: 'An investment term sheet.',
  shareholders_agreement: 'A shareholders’ agreement.',
  lease: 'A commercial lease or licence of premises.',
  other: 'A business document.',
};

export const generateUploadUrl = mutation({
  args: { token: v.string(), matterId: v.id('matters') },
  handler: async (ctx, { token, matterId }) => {
    await requireBusinessMatter(ctx, token, matterId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const add = mutation({
  args: { token: v.string(), matterId: v.id('matters'), storageId: v.id('_storage'), kind: v.string() },
  handler: async (ctx, { token, matterId, storageId, kind }) => {
    const { matter, business } = await requireBusinessMatter(ctx, token, matterId);
    if (matter.status === 'closed') throw new ConvexError('This matter is closed.');
    const meta = await ctx.db.system.get('_storage', storageId);
    if (!meta) throw new ConvexError('Upload failed. Please try again.');
    if (meta.size > MAX_BYTES || !/^(image\/|application\/pdf)/.test(meta.contentType ?? '')) {
      await ctx.storage.delete(storageId);
      throw new ConvexError('Please upload a PDF or photo under 10MB.');
    }
    const safeKind = (CONTRACT_KINDS as readonly string[]).includes(kind) ? kind : 'other';
    const docId = await ctx.db.insert('documents', {
      matterId,
      storageId,
      kind: safeKind,
      status: 'reading',
      confidence: 0,
      confirmedByClient: false,
      createdAt: Date.now(),
    });
    await audit(ctx, { matterId, actor: 'client', event: 'document_uploaded', detail: { kind: safeKind } });
    await ctx.scheduler.runAfter(0, internal.contracts.read, { docId });
    await recomputeTraction(ctx, business._id);
    return docId;
  },
});

export const remove = mutation({
  args: { token: v.string(), docId: v.id('documents') },
  handler: async (ctx, { token, docId }) => {
    const doc = await ctx.db.get(docId);
    if (!doc?.matterId) return;
    const { business } = await requireBusinessMatter(ctx, token, doc.matterId);
    if (doc.confirmedByClient) throw new ConvexError('This document has already been sent to our lawyer.');
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(docId);
    await audit(ctx, { matterId: doc.matterId, actor: 'client', event: 'document_removed', detail: { docId } });
    await recomputeTraction(ctx, business._id);
  },
});

/** Client has seen the highlighted clauses and sends the documents to the lawyer (DOC_REVIEW flag). */
export const submit = mutation({
  args: { token: v.string(), matterId: v.id('matters') },
  handler: async (ctx, { token, matterId }) => {
    const { matter } = await requireBusinessMatter(ctx, token, matterId);
    const docs = await ctx.db.query('documents').withIndex('by_matterId', (q) => q.eq('matterId', matterId)).take(20);
    const pending = docs.filter((d) => !d.confirmedByClient && d.status !== 'reading');
    if (!pending.length) throw new ConvexError('Add a document first, and wait for it to be read.');
    for (const d of pending) await ctx.db.patch(d._id, { confirmedByClient: true });
    await addFlagAndReview(ctx, matter, {
      code: 'DOC_REVIEW',
      reason: `${docs.length} document(s) attached for review.`,
      questionForLawyer: 'Review the highlighted clauses in the attached document(s).',
    });
    await audit(ctx, { matterId, actor: 'client', event: 'documents_submitted', detail: { count: pending.length } });
  },
});

// ---------- Internal: AI clause highlighting ----------

export const getDoc = internalQuery({
  args: { docId: v.id('documents') },
  handler: async (ctx, { docId }) => {
    const doc = await ctx.db.get(docId);
    if (!doc?.matterId) return null;
    const meta = await ctx.db.system.get('_storage', doc.storageId);
    return { storageId: doc.storageId, kind: doc.kind, contentType: meta?.contentType ?? 'application/pdf' };
  },
});

export const saveRead = internalMutation({
  args: {
    docId: v.id('documents'),
    status: v.union(v.literal('read'), v.literal('failed')),
    summary: v.string(),
    clauses: v.array(v.object({ title: v.string(), text: v.string(), why: v.string(), risk: v.union(v.literal('high'), v.literal('medium'), v.literal('low')) })),
    confidence: v.number(),
    meta: v.any(),
  },
  handler: async (ctx, { docId, clauses, meta, ...fields }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) return;
    await ctx.db.patch(docId, { ...fields, extracted: { clauses } });
    await audit(ctx, { matterId: doc.matterId, actor: 'ai:contracts.read', event: `document_${fields.status}`, detail: meta });
  },
});

function toBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

const RISKS = ['high', 'medium', 'low'] as const;

export const read = internalAction({
  args: { docId: v.id('documents') },
  handler: async (ctx, { docId }) => {
    const doc = await ctx.runQuery(internal.contracts.getDoc, { docId });
    if (!doc) return;
    try {
      const blob = await ctx.storage.get(doc.storageId);
      if (!blob) throw new Error('File missing');
      const { data, meta } = await geminiJson({
        model: SMART_MODEL,
        timeoutMs: 60000,
        system: `${TONE_BUSINESS}\nYou are highlighting clauses in a document for a founder and a Remedy lawyer. Do not give advice; explain what each clause does and why it might matter.`,
        image: { mimeType: doc.contentType, base64: toBase64(new Uint8Array(await blob.arrayBuffer())) },
        prompt: `${KIND_HINTS[doc.kind] ?? KIND_HINTS.other}
Do not copy names, addresses, bank details or signatures.
Return JSON: {"summary": string (one or two plain sentences on what the document is), "clauses": [{"title": string (e.g. "Intellectual property"), "text": string (a short quote or paraphrase, max 300 chars), "why": string (why a founder should look at it, plain English), "risk": "high" | "medium" | "low"}] (3 to 8 of the most important clauses, e.g. IP ownership, liability caps, termination, exclusivity, liquidation preference, vesting, rent review), "confidence": number 0..1}.
If the file is not a readable document, return {"summary": "We couldn’t read this document.", "clauses": [], "confidence": 0}.`,
        parse: (raw) => {
          const o = obj(raw);
          const clauses = Array.isArray(o.clauses)
            ? o.clauses
                .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
                .map((c) => ({
                  title: str(c.title, 80) ?? '',
                  text: str(c.text, 300) ?? '',
                  why: str(c.why, 400) ?? '',
                  risk: (RISKS as readonly string[]).includes(c.risk as string) ? (c.risk as (typeof RISKS)[number]) : 'medium',
                }))
                .filter((c) => c.title && c.why)
                .slice(0, 8)
            : [];
          return {
            summary: str(o.summary, 400) ?? 'Document read.',
            clauses,
            confidence: typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0.5,
          };
        },
      });
      await ctx.runMutation(internal.contracts.saveRead, { docId, status: 'read', ...data, meta });
    } catch (err) {
      console.warn('contract read failed', String(err).slice(0, 200));
      await ctx.runMutation(internal.contracts.saveRead, {
        docId,
        status: 'failed',
        summary: 'We couldn’t read this document automatically. Our lawyer can still review it.',
        clauses: [],
        confidence: 0,
        meta: { error: String(err).slice(0, 200) },
      });
    }
  },
});
