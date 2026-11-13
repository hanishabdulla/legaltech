import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/** MVP 2 (Remedy) tables. Spread into convex/schema.ts. See mvp2.md §5. */

export const businessStage = v.union(v.literal('idea'), v.literal('trading'), v.literal('raising'));

export const matterStatus = v.union(
  v.literal('answering'),
  v.literal('answered'), // AI only, no flags
  v.literal('in_review'),
  v.literal('awaiting_client'),
  v.literal('lawyer_checked'),
  v.literal('referral_suggested'),
  v.literal('closed'),
);

export const flagValidator = v.object({ code: v.string(), reason: v.string(), questionForLawyer: v.string() });

export const citationValidator = v.object({
  act: v.string(),
  section: v.string(),
  url: v.string(),
  chunkId: v.id('legislationChunks'),
});

export const reviewAction = v.union(
  v.literal('approve'),
  v.literal('edit_approve'),
  v.literal('request_info'),
  v.literal('recommend_firm'),
);

export const referralTrigger = v.union(v.literal('traction'), v.literal('lawyer'), v.literal('reserved_activity'));

export const remedyTables = {
  businesses: defineTable({
    sessionHash: v.string(),
    name: v.string(),
    companyNumber: v.optional(v.string()),
    sector: v.string(),
    headcount: v.number(),
    initialHeadcount: v.optional(v.number()),
    stage: businessStage,
    region: v.literal('england_wales'),
    plan: v.union(v.literal('starter'), v.literal('pro')),
    consentAt: v.number(),
    consentVersion: v.string(),
    createdAt: v.number(),
  }).index('by_sessionHash', ['sessionHash']),

  matters: defineTable({
    businessId: v.id('businesses'),
    question: v.string(),
    topic: v.string(), // employment | contracts | data | ip | company | property | consumer | other
    urgency: v.union(v.literal('high'), v.literal('standard')),
    status: matterStatus,
    flags: v.array(flagValidator),
    assignedStaffId: v.optional(v.id('staff')),
    dueAt: v.optional(v.number()), // service-level target
    finalAnswer: v.optional(v.string()),
    checkedByStaffId: v.optional(v.id('staff')),
    checkedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_businessId', ['businessId'])
    .index('by_status', ['status']),

  /** Client ↔ lawyer messages on a matter (request info / reply). */
  matterMessages: defineTable({
    matterId: v.id('matters'),
    from: v.union(v.literal('client'), v.literal('lawyer')),
    staffId: v.optional(v.id('staff')),
    text: v.string(),
    at: v.number(),
  }).index('by_matterId', ['matterId']),

  aiAnswers: defineTable({
    matterId: v.id('matters'),
    answer: v.string(),
    citations: v.array(citationValidator),
    confidence: v.number(),
    nextStep: v.string(),
    model: v.string(),
    promptHash: v.string(),
    createdAt: v.number(),
  }).index('by_matterId', ['matterId']),

  matterSummaries: defineTable({
    matterId: v.id('matters'),
    facts: v.array(v.object({ fact: v.string(), source: v.string() })), // 'client' | 'document'
    unknowns: v.array(v.string()),
    questionsForLawyer: v.array(v.string()),
    replyOptions: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_matterId', ['matterId']),

  reviews: defineTable({
    matterId: v.id('matters'),
    staffId: v.id('staff'),
    action: reviewAction,
    finalAnswer: v.optional(v.string()),
    messageToClient: v.optional(v.string()),
    privateNote: v.optional(v.string()),
    shareableNote: v.optional(v.string()),
    at: v.number(),
  }).index('by_matterId', ['matterId']),

  legislationChunks: defineTable({
    act: v.string(), // "Employment Rights Act 1996"
    section: v.string(), // "230"
    heading: v.string(),
    url: v.string(), // legislation.gov.uk section URL
    text: v.string(),
    topics: v.array(v.string()),
    inForce: v.boolean(),
    versionDate: v.string(),
    source: v.union(v.literal('legislation.gov.uk'), v.literal('gov.uk'), v.literal('fixture')),
    embedding: v.array(v.float64()),
    embeddingModel: v.string(),
  })
    .index('by_act_and_section', ['act', 'section'])
    .vectorIndex('by_embedding', { vectorField: 'embedding', dimensions: 768, filterFields: ['inForce'] })
    .searchIndex('search_text', { searchField: 'text', filterFields: ['inForce'] }),

  partnerFirms: defineTable({
    name: v.string(),
    licence: v.union(v.literal('anchor'), v.literal('partner')),
    sectors: v.array(v.string()), // business sectors, or 'any'
    city: v.string(),
    blurb: v.string(),
    active: v.boolean(),
  }),

  firmReferrals: defineTable({
    businessId: v.id('businesses'),
    firmId: v.id('partnerFirms'),
    matterIds: v.array(v.id('matters')),
    documentIds: v.array(v.id('documents')),
    reason: v.string(),
    trigger: referralTrigger,
    consent: v.object({ profile: v.boolean(), matters: v.boolean(), documents: v.boolean(), at: v.number() }),
    feeType: v.union(v.literal('submission'), v.literal('seed_ready')),
    feePence: v.number(), // recorded, not charged, in the MVP
    status: v.union(v.literal('sent'), v.literal('accepted'), v.literal('declined')),
    firmContact: v.optional(v.string()),
    declineReason: v.optional(v.string()),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index('by_businessId', ['businessId'])
    .index('by_firmId', ['firmId']),

  tractionScores: defineTable({
    businessId: v.id('businesses'),
    score: v.number(),
    signals: v.array(v.object({ signal: v.string(), points: v.number() })),
    computedAt: v.number(),
  }).index('by_businessId', ['businessId']),
};
