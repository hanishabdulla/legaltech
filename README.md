# Common Counsel: food, fuel and crisis support MVP

Expo (SDK 58, Expo Router) + Convex + Gemini. Built for the LegalTech in Leeds Hackathon from `mvp.md`. Nothing here is real: no real vouchers, referrals or council applications.

**Design rule: the AI reads, extracts, summarises and writes. The rules decide eligibility and deadlines. A named adviser approves anything that leaves the app.**

## Client flow (no account)

1. **`/start`**: "What's happened?" in your own words, or quick buttons. Language choice, consent notice, Exit this page, delete my data.
2. **`/intake/[caseId]`**: conversational intake. Gemini extracts structured facts from each message; the rules decide what is still missing and ask for it. "We understood" chips can be corrected. Falls back to **`/steps/[caseId]`** (step by step).
3. **`/upload/[caseId]`**: photo of a sanction letter, UC statement, bank statement or meter. Gemini reads it; the client confirms before it counts.
4. **`/result/[caseId]`**: pre-check per scheme (Leeds Crisis Payment, food bank referral, fuel support) with the rule trace. "Send to an adviser".
5. **`/plan/[caseId]`**: root-cause action plan, e.g. mandatory reconsideration with a computed deadline and a draft letter, Breathing Space via a debt adviser.
6. **`/track/[caseId]`**: status timeline. **`/wallet`**: demo vouchers, only after adviser approval.

## Adviser flow (`/adviser`, demo code `LEEDS`)

Queue sorted by urgency, AI three-line summary, flags, rule outcomes. Case view: facts with sources (client / document), documents, rule trace, editable AI case note, pre-filled referral fields, Approve / Reject with reason / Request info, audit trail.

Demo it with two browser tabs: client in one, adviser in the other. Everything updates live.

## Where things live

| Path | What |
|---|---|
| `convex/lib/facts.ts` | Facts model, validation, what's still needed, chip labels |
| `convex/lib/schemes/index.ts` | Rules: Leeds Crisis Payment, food bank, fuel. Return outcome + trace |
| `convex/lib/actionPlan.ts` | Issue → actions, MR deadline, letter template |
| `convex/lib/demoValues.ts` | Illustrative voucher amounts (placeholders) |
| `convex/intake.ts` | AI: intake turn, assessment (explain, triage, case note) |
| `convex/documents.ts` | Upload, AI document reading, client confirmation |
| `convex/cases.ts` | Client case API |
| `convex/adviser.ts` | Adviser queue, review, decisions |
| `convex/sessions.ts` | Anonymous client sessions, demo staff sign-in, delete my data |
| `convex/integrations/` | Partner adapters (all mocked) |

## Run

```bash
npm install
npx convex dev                         # backend
npx convex env set GEMINI_API_KEY <key>
npx expo start                         # i = iOS simulator, w = web
```

## Known gaps vs `mvp.md` (pilot work)

- Staff use a demo code, not Convex Auth; staff see all submitted cases, not just their organisation's.
- Client identity is an anonymous session token (hashed in Convex), not `ctx.auth`; no SMS magic link.
- No voice input, readability check, retention job, or tests yet.
- Gemini free tier: check data terms before any real client data (see `mvp.md` §5).
