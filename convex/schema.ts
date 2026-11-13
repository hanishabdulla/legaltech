import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const answersValidator = v.object({
  adults: v.number(),
  children: v.number(),
  reasons: v.array(v.string()),
  benefits: v.array(v.string()),
  income: v.string(),
  foodAtHome: v.string(),
  cooking: v.string(),
  dietary: v.array(v.string()),
  energy: v.string(),
  postcode: v.string(),
  story: v.string(),
});

export const followUpValidator = v.object({
  question: v.string(),
  answer: v.string(),
});

export const decisionValidator = v.object({
  eligible: v.boolean(),
  urgency: v.union(v.literal('urgent'), v.literal('standard')),
  headline: v.string(),
  summary: v.string(),
  reasons: v.array(v.string()),
  nextSteps: v.array(v.object({ title: v.string(), detail: v.string() })),
  safeguarding: v.optional(v.string()),
  caseNote: v.string(),
  foodValuePence: v.number(),
  fuelValuePence: v.number(),
  aiGenerated: v.boolean(),
});

export default defineSchema({
  users: defineTable({
    niNumber: v.string(),
    firstName: v.string(),
    dateOfBirth: v.string(),
    createdAt: v.number(),
  }).index('by_ni', ['niNumber']),

  assessments: defineTable({
    userId: v.id('users'),
    answers: answersValidator,
    followUps: v.array(followUpValidator),
    decision: decisionValidator,
    createdAt: v.number(),
  }).index('by_user', ['userId']),

  vouchers: defineTable({
    userId: v.id('users'),
    assessmentId: v.id('assessments'),
    kind: v.union(v.literal('food'), v.literal('fuel')),
    retailer: v.string(),
    valuePence: v.number(),
    code: v.string(),
    pin: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_assessment', ['assessmentId']),
});
