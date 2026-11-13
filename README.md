# Remedy: food, fuel and crisis support MVP

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

## Remedy: small business legal loop (MVP 2, `mvp2.md`)

**Design rule: the AI reads, retrieves and drafts. Rules (`convex/lib/flags.ts`) decide what is flagged and when a firm is suggested. A named lawyer approves anything flagged.** Demo data only; no real advice, referrals or firms.

Demo with three browser tabs, all live:

1. **Business, `/business`** (start at `/business/start`; tap **Demo** to fill in Jade Studio Ltd). Ask a question; the answer cites legislation.gov.uk / GOV.UK sections, shows the flag panel and an `AI answer` / `Lawyer checking` / `Lawyer-checked` badge. Attach a contract or term sheet at `/business/upload/[matterId]`; highlighted clauses show before it goes to the lawyer. Switch stage to **Raising** and upload a term sheet: the growth score passes 60 and `/business/firms` suggests panel firms, with the referral fee on every card and a consent checklist.
2. **Lawyer, `/lawyer`** (demo code `REMEDY`). Queue by urgency then age, flag chips, service-level timer (4 working hours high / 2 working days standard). Matter view: one-page matter summary (§6.3), editable AI draft, Approve / Edit and approve / Request info / Recommend firm, private vs shareable notes, audit trail.
3. **Firm, `/firm`** (code `REMEDY`, pick a panel firm). Inbox of handoff packs sent to that firm only; Accept with a contact name or Decline with a reason. Private lawyer notes are never included.

| Path | What |
|---|---|
| `convex/lib/remedySchema.ts` | MVP 2 tables (spread into `schema.ts`) |
| `convex/lib/flags.ts` | Flag rules, citation guard, inline citation rendering, keyword triage fallback |
| `convex/lib/traction.ts`, `convex/traction.ts` | Rules-based traction score; recalculated on change and nightly |
| `convex/lib/serviceLevel.ts` | Working-hours due dates (Europe/London) |
| `convex/legislation.ts`, `convex/seed/legislation.ts` | Corpus (47 sections/guide parts), ingest from legislation.gov.uk XML + GOV.UK Content API, Gemini embeddings (768d) + vector search, text-search fallback |
| `convex/matters.ts` | `ask` → `answer` (triage → retrieve → draft → guard → flags) → `summarise` |
| `convex/contracts.ts` | Contract upload and AI clause highlighting |
| `convex/lawyer.ts`, `convex/firms.ts`, `convex/business.ts` | Lawyer review, firm suggestion/handoff/inbox, business profile + delete my data |
| `convex/crons.ts` | Weekly legislation refresh, nightly traction rescoring |

```bash
npx convex run seed:run   # panel firms + fetch, parse and embed the legislation corpus
npm test                  # flag rules, citation guard, traction, service level, parser, authorisation (convex-test)
```

Known gaps (pilot work): Convex Auth instead of demo tokens/codes; matter summary PDF; email notifications; retrieval evaluation set; retention job.

## Legal drafting (both products)

Ask for a document in chat and get a PDF back in the chat. **The AI picks the template, collects answers and tidies the person's own words; the legal wording is fixed template text (partner-firm review is required before pilot use); every answer is validated in code.**

- **Remedy letters:** mandatory reconsideration (with one-month / 13-month rules), landlord repairs (LTA 1985 ss.9A, 11), deposit return, payment offer to a creditor, subject access request (UK GDPR Art. 15).
- **Remedy documents:** mutual or one-way NDA, freelancer services agreement, letter before action for an unpaid invoice (Late Payment Act interest and s.5A compensation for business debtors; Pre-Action Protocol and 30 days for individuals).
- **Refused:** wills and probate, property transfers, leases, court and tribunal forms, family law, powers of attorney, shareholder and employment documents. Each points somewhere that can help.
- **Where:** "write me a letter…" in the Remedy chat starts a draft; "Write this letter with me" on the action plan; "Need a letter written?" on the start page; "Draft a document" on the Remedy dashboard (and a prompt when a question sounds like a drafting request). Advisers see a client's drafted letters on the case.
- Answers are editable; "Leave blank" puts a line on the PDF for things like an NI number; consequential yes/no answers are always asked directly; PDFs are versioned.

| Path | What |
|---|---|
| `convex/lib/drafting/templates.ts` | Template catalogue: questions, fixed wording, warnings, next steps, out-of-scope list |
| `convex/lib/drafting/fields.ts` | Field kinds and validation (dates, money, choices, blanks) |
| `convex/lib/drafting/pdf.ts` | A4 PDF layout for letters and agreements (pdf-lib) |
| `convex/drafting.ts` | `start` / `send` / `setAnswer` / `generate` / `get` / `mine` / `remove` |
| `convex/lib/drafting/drafting.test.ts` | Renders every template + PDF, validation and legal-rule tests |

## Website (Next.js, `web/`)

A desktop-first Next.js site for both products (landing page, Remedy client + adviser, Remedy business + lawyer + firm) on the same Convex backend. See `web/README.md`. Run with `cd web && npm run dev`.

## Web app

Live: **https://agile-caiman-767.convex.site** (production Convex deployment, hosted with `@convex-dev/static-hosting`).

- Client screens stay a centred mobile-width column; the adviser queue and case view use the full desktop width (grid queue, two-column case review).
- `npm run deploy` builds the web app with the production Convex URL, deploys the backend and uploads `dist/`.
- `npx @convex-dev/static-hosting upload --build` publishes to the dev deployment (https://brilliant-octopus-164.convex.site) for a smoke test.
- HTTP actions, if added later, live under `/api` because the site owns `/`.

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
npm run deploy                         # publish web app + backend to production
```

## Known gaps vs `mvp.md` (pilot work)

- Staff use a demo code, not Convex Auth; staff see all submitted cases, not just their organisation's.
- Client identity is an anonymous session token (hashed in Convex), not `ctx.auth`; no SMS magic link.
- No voice input, readability check, retention job, or tests yet.
- Gemini free tier: check data terms before any real client data (see `mvp.md` §5).
