import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, mutation } from './_generated/server';
import { mergeFacts } from './cases';
import { audit, requireClientCase } from './lib/auth';
import { factsValidator, sanitiseFacts } from './lib/facts';
import { SMART_MODEL, TONE, geminiJson, obj, str } from './lib/gemini';

export const DOCUMENT_KINDS = ['uc_statement', 'sanction_letter', 'bank_statement', 'meter_photo', 'other'] as const;

const KIND_PROMPTS: Record<string, string> = {
  uc_statement:
    'A Universal Credit statement. Extract: benefits (include "universal_credit"), adults/children if shown, and if there is a sanction deduction set reasons ["benefit_change"] and benefitDecisionType "sanction". moneyAvailablePence only if a payment amount clearly is all they have.',
  sanction_letter:
    'A DWP decision or sanction letter. Extract benefitDecisionDate (the date of the decision on the letter, YYYY-MM-DD), benefitDecisionType, reasons ["benefit_change"], and benefits.',
  bank_statement: 'A bank statement. Extract moneyAvailablePence from the latest closing balance (0 if overdrawn).',
  meter_photo:
    'A photo of a prepayment gas or electricity meter display. Set hasPrepaymentMeter true. Extract meterCreditPence from the credit shown (negative or 0 if on emergency credit).',
  other: 'Any document about benefits, debts, bills or money. Extract any matching facts.',
};

const MAX_BYTES = 8 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: { token: v.string(), caseId: v.id('cases') },
  handler: async (ctx, { token, caseId }) => {
    await requireClientCase(ctx, token, caseId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const add = mutation({
  args: { token: v.string(), caseId: v.id('cases'), storageId: v.id('_storage'), kind: v.string() },
  handler: async (ctx, { token, caseId, storageId, kind }) => {
    const { case: c } = await requireClientCase(ctx, token, caseId);
    if (c.status !== 'draft') throw new ConvexError('This case has already been sent to an adviser.');
    const meta = await ctx.db.system.get('_storage', storageId);
    if (!meta) throw new ConvexError('Upload failed. Please try again.');
    if (meta.size > MAX_BYTES || !/^(image\/|application\/pdf)/.test(meta.contentType ?? '')) {
      await ctx.storage.delete(storageId);
      throw new ConvexError('Please upload a photo or PDF under 8MB.');
    }
    const docId = await ctx.db.insert('documents', {
      caseId,
      storageId,
      kind: (DOCUMENT_KINDS as readonly string[]).includes(kind) ? kind : 'other',
      status: 'reading',
      confidence: 0,
      confirmedByClient: false,
      createdAt: Date.now(),
    });
    await audit(ctx, { caseId, actor: 'client', event: 'document_uploaded', detail: { kind } });
    await ctx.scheduler.runAfter(0, internal.documents.read, { docId });
    return docId;
  },
});

/** Client confirms (or corrects) the values read from a document. Only then do they count. */
export const confirm = mutation({
  args: { token: v.string(), docId: v.id('documents'), facts: factsValidator },
  handler: async (ctx, { token, docId, facts }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) throw new ConvexError('Document not found.');
    const { case: c } = await requireClientCase(ctx, token, doc.caseId);
    if (c.status !== 'draft') throw new ConvexError('This case has already been sent to an adviser.');
    const merged = mergeFacts(c, sanitiseFacts(facts), 'document');
    await ctx.db.patch(c._id, { ...merged, assessedAt: undefined, updatedAt: Date.now() });
    await ctx.db.patch(docId, { confirmedByClient: true, extracted: facts });
    await audit(ctx, { caseId: c._id, actor: 'client', event: 'document_confirmed', detail: { docId, keys: Object.keys(facts) } });
  },
});

export const remove = mutation({
  args: { token: v.string(), docId: v.id('documents') },
  handler: async (ctx, { token, docId }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) return;
    await requireClientCase(ctx, token, doc.caseId);
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(docId);
    await audit(ctx, { caseId: doc.caseId, actor: 'client', event: 'document_removed', detail: { docId } });
  },
});

// ---------- Internal: reading the document with AI ----------

export const getDoc = internalQuery({
  args: { docId: v.id('documents') },
  handler: async (ctx, { docId }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) return null;
    const meta = await ctx.db.system.get('_storage', doc.storageId);
    return { ...doc, contentType: meta?.contentType ?? 'image/jpeg' };
  },
});

export const saveRead = internalMutation({
  args: {
    docId: v.id('documents'),
    status: v.union(v.literal('read'), v.literal('failed')),
    extracted: v.optional(factsValidator),
    summary: v.optional(v.string()),
    confidence: v.number(),
    meta: v.any(),
  },
  handler: async (ctx, { docId, meta, ...fields }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) return;
    await ctx.db.patch(docId, fields);
    await audit(ctx, { caseId: doc.caseId, actor: 'ai:documents.read', event: `document_${fields.status}`, detail: meta });
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

export const read = internalAction({
  args: { docId: v.id('documents') },
  handler: async (ctx, { docId }) => {
    const doc = await ctx.runQuery(internal.documents.getDoc, { docId });
    if (!doc) return;
    try {
      const blob = await ctx.storage.get(doc.storageId);
      if (!blob) throw new Error('File missing');
      const base64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
      const { data, meta } = await geminiJson({
        model: SMART_MODEL,
        timeoutMs: 45000,
        system: TONE,
        image: { mimeType: doc.contentType, base64 },
        prompt: `Read this document. ${KIND_PROMPTS[doc.kind] ?? KIND_PROMPTS.other}
Today is ${new Date().toISOString().slice(0, 10)}. Never extract names, addresses, account numbers or National Insurance numbers.
Return JSON: {"facts": object (fields: benefits, reasons, benefitDecisionDate, benefitDecisionType, moneyAvailablePence, hasPrepaymentMeter, meterCreditPence, adults, children, debtTypes; only those you can see), "summary": string (one plain sentence describing what the document shows, e.g. "Universal Credit statement showing a £84.25 sanction deduction on 3 November"), "confidence": number 0..1 (how sure you are about the values)}.
If the image is not a readable document, return {"facts": {}, "summary": "We couldn’t read this document.", "confidence": 0}.`,
        parse: (raw) => {
          const o = obj(raw);
          return {
            facts: sanitiseFacts(o.facts && typeof o.facts === 'object' ? (o.facts as Record<string, unknown>) : {}),
            summary: str(o.summary, 300) ?? 'Document read.',
            confidence: typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : 0.5,
          };
        },
      });
      await ctx.runMutation(internal.documents.saveRead, {
        docId,
        status: 'read',
        extracted: data.facts,
        summary: data.summary,
        confidence: data.confidence,
        meta,
      });
    } catch (err) {
      console.warn('document read failed', err);
      await ctx.runMutation(internal.documents.saveRead, {
        docId,
        status: 'failed',
        summary: 'We couldn’t read this document automatically. An adviser can still look at it.',
        confidence: 0,
        meta: { error: String(err).slice(0, 200) },
      });
    }
  },
});
