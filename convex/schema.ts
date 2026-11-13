import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { factsValidator } from './lib/facts';

export const caseStatus = v.union(
  v.literal('draft'),
  v.literal('submitted'),
  v.literal('in_review'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('referred'),
  v.literal('closed'),
);

export const outcomeValidator = v.union(v.literal('likely'), v.literal('unlikely'), v.literal('needs_info'));

export default defineSchema({
  /** Anonymous by default. No name, NI number or login needed to get help. */
  clients: defineTable({
    sessionHash: v.string(),
    language: v.string(),
    consentAt: v.number(),
    consentVersion: v.string(),
    createdAt: v.number(),
  }).index('by_sessionHash', ['sessionHash']),

  staff: defineTable({
    name: v.string(),
    organisation: v.string(),
    role: v.union(v.literal('adviser'), v.literal('supervisor'), v.literal('admin')),
    createdAt: v.number(),
  }),

  staffSessions: defineTable({
    staffId: v.id('staff'),
    sessionHash: v.string(),
    createdAt: v.number(),
  }).index('by_sessionHash', ['sessionHash']),

  cases: defineTable({
    clientId: v.id('clients'),
    status: caseStatus,
    facts: factsValidator,
    factConfidence: v.record(v.string(), v.number()),
    factSources: v.record(v.string(), v.string()), // field -> 'client' | 'document' | 'adviser'
    story: v.string(), // what the client wrote first, in their own words
    transcript: v.array(v.object({ role: v.union(v.literal('client'), v.literal('assistant')), text: v.string(), at: v.number() })),
    nextQuestion: v.optional(v.object({ key: v.string(), text: v.string(), suggestions: v.array(v.string()) })),
    intakeDone: v.boolean(),
    urgency: v.union(v.literal('urgent'), v.literal('standard')),
    safeguardingFlag: v.optional(v.string()),
    issues: v.array(v.string()),
    clientSummary: v.optional(v.string()),
    adviserSummary: v.optional(v.string()),
    caseNote: v.optional(v.string()),
    adviserFlags: v.array(v.string()),
    adviserMessage: v.optional(v.string()),
    retailer: v.optional(v.string()),
    assessedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    assignedStaffId: v.optional(v.id('staff')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clientId', ['clientId'])
    .index('by_status', ['status']),

  documents: defineTable({
    caseId: v.id('cases'),
    storageId: v.id('_storage'),
    kind: v.string(),
    status: v.union(v.literal('reading'), v.literal('read'), v.literal('failed')),
    extracted: v.optional(v.any()), // proposed facts, validated by sanitiseFacts before use
    summary: v.optional(v.string()),
    confidence: v.number(),
    confirmedByClient: v.boolean(),
    createdAt: v.number(),
  }).index('by_caseId', ['caseId']),

  eligibility: defineTable({
    caseId: v.id('cases'),
    scheme: v.string(),
    outcome: outcomeValidator,
    trace: v.array(v.object({ criterion: v.string(), met: v.union(v.boolean(), v.null()), evidence: v.string() })),
    flags: v.array(v.string()),
    explanation: v.optional(v.string()),
    toFinish: v.array(v.string()),
    rulesetVersion: v.string(),
  }).index('by_caseId', ['caseId']),

  referrals: defineTable({
    caseId: v.id('cases'),
    scheme: v.string(),
    payload: v.any(), // pre-filled form fields for the partner
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'), v.literal('sent')),
    decidedBy: v.optional(v.id('staff')),
    decidedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_caseId', ['caseId'])
    .index('by_status', ['status']),

  actions: defineTable({
    caseId: v.id('cases'),
    type: v.string(),
    title: v.string(),
    detail: v.string(),
    deadline: v.optional(v.number()),
    deadlineBasis: v.optional(v.string()),
    draftLetter: v.optional(v.string()),
    handoffTo: v.optional(v.string()),
    handoffContact: v.optional(v.string()),
    status: v.union(v.literal('todo'), v.literal('done'), v.literal('handed_off')),
  }).index('by_caseId', ['caseId']),

  /** Demo wallet. Vouchers only exist after an adviser approves a referral. */
  vouchers: defineTable({
    clientId: v.id('clients'),
    caseId: v.id('cases'),
    referralId: v.id('referrals'),
    kind: v.union(v.literal('food'), v.literal('fuel')),
    retailer: v.string(),
    valuePence: v.number(),
    code: v.string(),
    pin: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index('by_clientId', ['clientId'])
    .index('by_caseId', ['caseId']),

  auditLog: defineTable({
    caseId: v.optional(v.id('cases')),
    actor: v.string(), // 'client' | 'ai:<function>' | 'staff:<id>' | 'system'
    event: v.string(),
    detail: v.any(),
    at: v.number(),
  }).index('by_caseId', ['caseId']),
});
