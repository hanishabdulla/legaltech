import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const draftStatus = v.union(v.literal('collecting'), v.literal('ready'), v.literal('generated'));

export const draftMessage = v.object({
  role: v.union(v.literal('client'), v.literal('assistant')),
  text: v.string(),
  at: v.number(),
  /** A generated PDF attached to this message. */
  pdf: v.optional(v.object({ storageId: v.id('_storage'), version: v.number(), pages: v.number() })),
});

export const draftTables = {
  /**
   * A document being drafted in chat. Owned by an anonymous Remedy
   * client (optionally linked to a case) or a Remedy business (optionally
   * linked to a matter). Answers are kept so the person can edit and re-create.
   */
  drafts: defineTable({
    clientId: v.optional(v.id('clients')),
    caseId: v.optional(v.id('cases')),
    businessId: v.optional(v.id('businesses')),
    matterId: v.optional(v.id('matters')),
    templateId: v.string(),
    status: draftStatus,
    answers: v.record(v.string(), v.string()),
    /** AI-tidied versions of free-text answers, keyed by field. Cleared when the answer changes. */
    tidied: v.record(v.string(), v.string()),
    transcript: v.array(draftMessage),
    nextField: v.optional(v.object({ key: v.string(), text: v.string(), suggestions: v.array(v.string()) })),
    warnings: v.array(v.string()),
    /** YYYY-MM-DD used for date rules; refreshed on every change. */
    today: v.string(),
    version: v.number(),
    pdfStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_caseId', ['caseId'])
    .index('by_businessId', ['businessId']),
};
