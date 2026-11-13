# Remedy: MVP technical plan

Status: draft, written 13 November 2026 against `main` at `5f20598`.
Scope: what has to be built to turn the current food and energy voucher prototype into the Remedy MVP described on the team's Miro board (Type 1: food, fuel and crisis support in Leeds, under English law).

The plan has two horizons:

- **Hackathon demo (today, before the 15:00 pitch):** the smallest set of changes that makes the AI visible and shows a human signing off.
- **Pilot MVP (8 weeks):** what a Leeds pilot with one advice partner and one law clinic would need.

---

## 1. Where we are today

### Stack

| Layer | What's there |
|---|---|
| App | Expo SDK 58, Expo Router, React Native 0.88. Runs on web, iOS simulator and Android emulator. |
| Backend | Convex (local anonymous deployment at `127.0.0.1:3210`). |
| AI | Gemini over REST in `convex/lib/gemini.ts`. `gemini-flash-lite-latest` for follow-ups, `gemini-flash-latest` for the assessment. JSON output, temperature 0.4. |
| Rules | `convex/lib/policy.ts`: deterministic eligibility signals, voucher values, 3-per-6-months limit. |
| Questions | `convex/lib/questions.ts`: options for reasons, benefits, income, food at home, cooking, diet, energy. |

### Current flow

1. **Sign in** (`src/app/sign-in.tsx`, `convex/users.ts`): first name, National Insurance number and date of birth. Format check only.
2. **Check** (`src/app/(app)/check.tsx`): 9 fixed screens (household, reasons, benefits, income, food at home, cooking, diet, energy, postcode plus free text).
3. **AI follow-ups** (`assessments.followUps`): Gemini may ask up to 2 extra questions with tap-to-answer chips.
4. **Assess** (`assessments.assess`): `applyPolicy()` computes eligibility signals and values. Gemini writes the headline, summary, reasons, next steps, a safeguarding notice and an adviser case note.
5. **Claim** (`vouchers.claim`): the person picks a supermarket and the app issues a food voucher (30 days) and, if relevant, a fuel voucher (90 days) with random codes and PINs.
6. **Wallet** (`wallet.tsx`, `voucher/[id].tsx`): QR code, code, PIN, status, "mark as used".

### Why it feels like "just forms"

The AI exists but sits at the edges:

- **It is optional and silent.** If `GEMINI_API_KEY` is not set on the Convex deployment, or a call fails, `followUps` returns `[]` and `assess` falls back to rules (`aiGenerated: false`). The user sees the same fixed form either way.
- **Intake is a fixed questionnaire.** The free-text "your situation" box comes last and is only passed to the model as context. Nothing is extracted from it.
- **The AI cannot see documents, does not hold a conversation, does not route, and does not identify the legal problem behind the crisis.**

### Gaps against the Remedy concept

| # | Gap | Where in code | Why it matters |
|---|---|---|---|
| G1 | **No human in the loop.** Vouchers are issued instantly by the app. | `vouchers.claim` | The board's flow is "one-click sign-off by a registered referrer". Real food bank and council routes need a referral agency or a council decision. Judges will ask who approves. |
| G2 | **AI can grant eligibility.** | `assess`: `policy.eligible \|\| ai?.eligible === true` | For an MVP the rules decide, the AI explains and a person approves. A model should never be the reason someone gets or is refused help. |
| G3 | **Generic policy, invented values.** £30 plus £15 per extra person (cap £120), fuel £49 or £25. | `policy.ts` | These are placeholders and must be labelled as such. Leeds Crisis Payment Scheme criteria are not modelled. |
| G4 | **The 3-in-6-months rule is a hard block.** | `policy.ts` | In the Trussell e-referral process, more than 3 vouchers in 6 months requires a recorded reason and a conversation with the food bank. It is a flag, not a ban (Cardiff Foodbank e-referral handbook, March 2024). |
| G5 | **NI number as login.** | `users.signIn` | A crisis user should get help without an account. An NI number is a government identifier: collect it only when a scheme needs it, with consent. |
| G6 | **No authorisation.** Every query takes `userId` as an argument and trusts it. | all of `convex/` | Anyone holding an ID can read that person's case. Fine for a demo, unacceptable for a pilot. Identity must come from `ctx.auth`. |
| G7 | **No document upload or reading.** | none | The board's step 2 is "upload documents; AI checks ID, meter credit and bank statement". |
| G8 | **No legal action plan.** | none | The board's step 6 is "root cause (debt, benefits, housing) passed on as a type 2 claim". Today "next steps" is a free-text list from the model with no deadlines. |
| G9 | **No adviser view.** | none | No queue, no approve or reject, no audit trail. |
| G10 | **No consent, privacy notice or deletion.** | none | Dietary needs are health data (special category under UK GDPR). Ethnicity, if collected, is too. |
| G11 | **Accessibility and safety basics missing.** | UI | No language switch, no voice input, no "Exit this page" control, untested with a screen reader. |

What is already good and should be kept: the plain-English tone prompt, one question per screen, large tap targets, the rules-first design in `policy.ts`, the safeguarding notice, the case note "so you don't have to tell your story again", and graceful fallback when the AI fails.

---

## 2. What the MVP must prove

> A person in crisis in Leeds can explain their situation in their own words at any hour, have the facts and documents organised by AI, get an honest eligibility pre-check against the published criteria, and have a referral ready for an adviser to approve in one click. The cause of the crisis (a sanction, debt, rent arrears) is turned into an action plan with deadlines.

Out of scope for the MVP: real voucher issuance, live Trussell or council integrations, payments, the small business tier, living contracts, the clinic network.

---

## 3. Target architecture

```
                     ┌──────────────────────────────┐
  Client app         │  Expo app (web + mobile)      │
  (no account)       │  /start  /intake  /upload     │
                     │  /result /plan    /track      │
                     └──────────────┬───────────────┘
                                    │ Convex client
  Adviser app        ┌──────────────┴───────────────┐
  (signed in)        │  /adviser  /adviser/case/[id] │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │            Convex             │
                     │  tables: clients, cases,      │
                     │  documents, eligibility,      │
                     │  referrals, actions, staff,   │
                     │  auditLog                     │
                     │                               │
                     │  actions ──► AI layer (Gemini)│
                     │   intake.extract              │
                     │   documents.read              │
                     │   cases.explain               │
                     │   cases.summariseForAdviser   │
                     │   actions.draftLetter         │
                     │                               │
                     │  pure TS ──► rules layer      │
                     │   schemes/leedsCrisisPayment  │
                     │   schemes/foodBankReferral    │
                     │   schemes/fuelSupport         │
                     │   deadlines/*                 │
                     └──────────────┬───────────────┘
                                    │ adapters (mocked in MVP)
              SMS · Trussell referral · Leeds CRPS form · Fuel Bank Foundation
```

**Design rule:** the AI reads, extracts, summarises and writes. The rules decide eligibility and deadlines. A named adviser approves anything that leaves the app.

---

## 4. Data model (`convex/schema.ts`)

Replace `users` and `assessments` with the tables below. Keep `vouchers` for the demo wallet, but issue only after approval.

```ts
clients: defineTable({
  // anonymous by default; contact added only with consent
  displayName: v.optional(v.string()),
  phone: v.optional(v.string()),          // for SMS magic link and updates
  language: v.string(),                   // 'en', 'ur', 'pl', ...
  consentAt: v.optional(v.number()),
  consentVersion: v.optional(v.string()),
  createdAt: v.number(),
}),

cases: defineTable({
  clientId: v.id('clients'),
  status: v.union(
    v.literal('draft'), v.literal('submitted'), v.literal('in_review'),
    v.literal('approved'), v.literal('rejected'), v.literal('referred'), v.literal('closed'),
  ),
  postcodeDistrict: v.optional(v.string()),   // e.g. 'LS9', never the full postcode
  facts: factsValidator,                      // structured, see below
  factConfidence: v.record(v.string(), v.number()),
  transcript: v.array(v.object({ role: v.string(), text: v.string(), at: v.number() })),
  urgency: v.union(v.literal('urgent'), v.literal('standard')),
  safeguardingFlag: v.optional(v.string()),
  clientSummary: v.optional(v.string()),     // plain English, to the client
  adviserSummary: v.optional(v.string()),    // three lines, for the queue
  caseNote: v.optional(v.string()),
  assignedStaffId: v.optional(v.id('staff')),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_client', ['clientId']).index('by_status', ['status']),

documents: defineTable({
  caseId: v.id('cases'),
  storageId: v.id('_storage'),
  kind: v.string(),                 // 'uc_statement' | 'bank_statement' | 'sanction_letter' | 'meter_photo' | 'other'
  extracted: v.any(),               // validated per kind before saving
  confidence: v.number(),
  confirmedByClient: v.boolean(),
}).index('by_case', ['caseId']),

eligibility: defineTable({
  caseId: v.id('cases'),
  scheme: v.string(),               // 'leeds_crisis_payment' | 'food_bank_referral' | 'fuel_support'
  outcome: v.union(v.literal('likely'), v.literal('unlikely'), v.literal('needs_info')),
  trace: v.array(v.object({ criterion: v.string(), met: v.union(v.boolean(), v.null()), evidence: v.string() })),
  rulesetVersion: v.string(),
}).index('by_case', ['caseId']),

referrals: defineTable({
  caseId: v.id('cases'),
  scheme: v.string(),
  payload: v.any(),                 // pre-filled form fields for the partner
  status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'), v.literal('sent')),
  decidedBy: v.optional(v.id('staff')),
  decidedAt: v.optional(v.number()),
  reason: v.optional(v.string()),
}).index('by_case', ['caseId']).index('by_status', ['status']),

actions: defineTable({            // the legal action plan
  caseId: v.id('cases'),
  type: v.string(),                 // 'mandatory_reconsideration' | 'breathing_space' | 'debt_advice' | ...
  title: v.string(),
  deadline: v.optional(v.number()),
  deadlineBasis: v.optional(v.string()),   // the rule and source used to compute it
  draftLetter: v.optional(v.string()),
  handoffTo: v.optional(v.string()),       // 'Leeds Citizens Advice', 'Welfare Rights Team', ...
  status: v.union(v.literal('todo'), v.literal('done'), v.literal('handed_off')),
}).index('by_case', ['caseId']),

staff: defineTable({
  tokenIdentifier: v.string(),      // from ctx.auth
  name: v.string(),
  organisation: v.string(),
  role: v.union(v.literal('adviser'), v.literal('supervisor'), v.literal('admin')),
}).index('by_token', ['tokenIdentifier']),

auditLog: defineTable({
  caseId: v.optional(v.id('cases')),
  actor: v.string(),                // 'client' | 'ai:<function>' | staff id
  event: v.string(),
  detail: v.any(),
  at: v.number(),
}).index('by_case', ['caseId']),
```

`factsValidator` extends today's `answersValidator` with the fields the new rules need: `age16Plus`, `leedsResident`, `qualifyingBenefits[]`, `crisisType`, `moneyAvailablePence`, `lastCrisisPaymentAt`, `benefitDecisionDate`, `hasPrepaymentMeter`, `meterCreditPence`, `debtTypes[]`. Every field is optional, because the intake fills them progressively.

---

## 5. AI features to build

Each feature: an internal Convex action, a strict JSON schema, validation before saving, an audit log entry and a non-AI fallback.

### 5.1 Conversational intake (replaces the fixed 9 screens as the default)

- **Input:** what the client types or says, plus the facts gathered so far.
- **Output:** `{ facts: Partial<Facts>, confidence: Record<field, 0..1>, missing: Field[], nextQuestion: { text, suggestions[] } | null, safeguarding: string | null }`.
- **Loop:** ask only for fields that are missing or low confidence. Stop when the rules have what they need, or after 8 turns.
- **Fallback:** the existing screens in `check.tsx` become "answer step by step instead". Keep `questions.ts` as the single source of option lists for both paths.
- **UI:** first screen "Tell us what's happened" with a text box, a mic button and the existing large reason buttons as shortcuts. Show "We understood:" chips the client can correct.

### 5.2 Document reading

- **Input:** a photo or PDF in Convex file storage, sent to Gemini as inline image data.
- **Output per kind:** a UC statement gives payment date, amount and deductions (sanction lines). A sanction or decision letter gives the decision date and decision type. A bank statement gives balance and date. A meter photo gives credit and emergency credit.
- **Rule:** the client confirms extracted values before they count ("Is this right? £12.40 on 3 November"). Low confidence values are never used silently.
- **Privacy:** documents are deleted when the case closes or after the retention period, whichever comes first.

### 5.3 Eligibility explanation (AI explains, rules decide)

- **Remove G2:** delete the `ai?.eligible === true` override in `assessments.assess`.
- New pure functions in `convex/lib/schemes/` return `{ outcome, trace[] }`. The AI turns the trace into two kind sentences per scheme and a "what you need to finish this" list.

### 5.4 Root-cause triage and action plan

- The AI classifies the crisis reasons and the free text into issue types: benefit sanction or decision, benefit delay, problem debt, rent arrears or eviction, unpaid wages, energy debt.
- Deterministic deadline functions in `convex/lib/deadlines/` compute dates only where the rule is clear and sourced (see 6.3). Each action stores `deadlineBasis`.
- Letters come from lawyer-reviewed templates. The AI fills facts into fixed paragraphs and does not write legal argument.
- Every action is labelled "Information, not legal advice" and names a free service to hand off to.

### 5.5 Adviser copilot

- A three-line queue summary, a full case note in the existing `Household / Circumstances / Income / Need / Outcome` format, flags for contradictions, missing evidence and safeguarding, and a suggested referral.
- The adviser can edit any AI text before approving. The edit is logged.

### 5.6 Safeguarding

- Keep the current behaviour and make it stricter: any safeguarding signal moves the case to the top of the queue with `urgency: 'urgent'` and shows 999 and the National Domestic Abuse Helpline (0808 2000 247) on the client's screen. The AI cannot close or downgrade a safeguarding case.

### 5.7 Language and readability

- Generate client-facing text in `clients.language`. Run a simple readability check on English output and regenerate if it reads above roughly a reading age of 9.

### AI guardrails (apply to all of the above)

- Client text is data, never instructions. Wrap it in delimiters and tell the model so.
- Send the model only what the task needs. Never send name, phone or NI number.
- Validate every response against its schema. On failure, retry once, then use the fallback.
- Log the model name, a prompt hash, output and latency to `auditLog`.
- Before any real client data is used, check the Gemini API terms for the tier in use: unpaid tiers may allow Google to use prompts to improve its products. A pilot needs a paid tier or Vertex AI with a data processing agreement.

---

## 6. Rules to encode

### 6.1 Leeds Crisis Payment Scheme (`schemes/leedsCrisisPayment.ts`)

Source: leeds.gov.uk/benefits/crisis-payment-scheme, checked 13 November 2026. It replaced the Local Welfare Support Scheme from 1 April 2026. Criteria:

- Leeds resident, aged 16 or over.
- Insufficient funds and no quick way to raise income or get other emergency help.
- Entitled to, or applying for, a listed benefit or discount (for example Universal Credit, Housing Benefit, Council Tax Support).
- Meets one crisis definition (for example sudden loss of income, an unexpected essential bill over £100, a recent diagnosis while waiting for a health-related benefit decision, moving from supported or emergency accommodation, a recent flood, fire, theft or threat of violence).
- For food or fuel support: not eligible if the client or their partner has £150 or more available.
- Generally not eligible if they had a Crisis Payment in the last 12 months (exception: moving from supported or emergency accommodation).
- Applications: online form, or 0800 953 2303 / 0113 376 0330.

The council's page states: "We are refusing 80% of applications received because criteria have not been met." The pre-check exists to cut that number. The council still makes the decision. The app only says "likely", "unlikely" or "we need more information".

### 6.2 Food bank referral (`schemes/foodBankReferral.ts`)

- Needs a referral from an agency: in Leeds South & East, the 12 Community Hubs, Forward Leeds, Engage Leeds, housing support, schools and GPs. Without a support worker: Leeds Citizens Advice 0808 278 7878 or Help Through Hardship 0808 208 2138.
- More than 3 vouchers in 6 months: record a reason and prompt the adviser to contact the food bank. Replaces the hard block in `policy.ts` (G4).
- Capture what the Trussell form captures (household size, income source, up to 4 reasons, dietary needs, collection or delivery) so the adviser can copy it across.

### 6.3 Deadlines (`deadlines/`)

Only encode deadlines the team can cite:

- **Mandatory reconsideration** of a DWP decision: within one month of the date on the decision letter.
- **Breathing Space** (Debt Respite Scheme): 60 days of protection from most creditor action once a debt adviser applies. Hand off to a debt adviser, since debt advice is FCA-regulated.

Anything else is a handoff, not a computed deadline, until a lawyer has reviewed it.

### 6.4 Voucher values

`policy.ts` values are placeholders. Rename them `DEMO_*`, show "Illustrative amount" in the UI, and replace them with the pilot partner's real figures.

---

## 7. Screens

### Client (no account needed)

| Route | Purpose | Replaces |
|---|---|---|
| `/start` | "What's happened?" text, mic and quick buttons. Language switch. Exit this page. | `sign-in.tsx`, `home.tsx` hero |
| `/intake/[caseId]` | Conversational intake with "We understood" chips. Falls back to step-by-step. | `check.tsx` |
| `/upload/[caseId]` | Photo upload, extracted values, confirm or correct. | new |
| `/result/[caseId]` | Per-scheme pre-check with the rule trace in plain English. "Send to an adviser" button. | `result/[id].tsx` |
| `/plan/[caseId]` | Action plan with deadline countdowns, draft letters, handoff contacts. | new |
| `/track/[caseId]` | Status timeline: Submitted, Adviser checking, Approved, Referral sent, Ready to collect. | new |
| `/wallet` | Only shows vouchers after approval. Marked as demo. | keep |

Persistent elements: an "Exit this page" button on every client screen, an "AI prepared, adviser approved" badge on outputs, and "Information, not legal advice".

### Adviser (signed in)

| Route | Purpose |
|---|---|
| `/adviser` | Queue sorted by urgency then age. Three-line summary, flags, scheme outcomes. |
| `/adviser/case/[caseId]` | Facts with sources (client said / document / adviser), documents, rule trace, AI case note (editable), referral payload. Buttons: Approve, Edit, Request info, Reject with reason. |

---

## 8. Auth, roles and security

- **Clients:** anonymous Convex session on first open. Optional phone number for an SMS magic link to come back later and get status updates. No password.
- **Staff:** Convex Auth (email magic link or password) with the `staff` table for role and organisation.
- **Fix G6:** every query and mutation derives identity from `ctx.auth`, never from a `userId` argument. Clients see only their own cases. Staff see cases for their organisation.
- **Audit:** every status change, AI call and staff edit writes to `auditLog`.
- **Secrets:** `GEMINI_API_KEY` and any SMS keys live only in Convex environment variables, never in the app bundle or in `EXPO_PUBLIC_*`.

---

## 9. Integrations (mocked in the MVP)

| Partner | MVP | Later |
|---|---|---|
| Trussell e-referral | Adviser copies the pre-filled summary into Trussell's system by hand. The e-referral system is invite-only and has no public API. | Partnership with Trussell. |
| Leeds Crisis Payment Scheme | Pre-filled summary the client or adviser uses to complete the council's online form. | Discuss a referral route with Leeds City Council. |
| Fuel support | Mock referral to a fuel voucher partner. | Fuel Bank Foundation or the local energy advice service. |
| SMS | Mock adapter in the demo; Twilio for the pilot. | Same. |
| Citizens Advice | Case note handoff, so the client does not repeat their story. | Shared case record with consent. |

Put each partner behind an adapter in `convex/integrations/<partner>.ts` with a `send()` that the mock implements today.

---

## 10. Compliance checklist (pilot gate)

- [ ] DPIA completed. Lawful basis recorded. Explicit consent captured for special category data (health and diet; ethnicity only if collected).
- [ ] Privacy notice in plain English, shown before any data is saved. "Delete my data" available from every screen.
- [ ] Data minimisation: postcode district only, no NI number unless a scheme needs it.
- [ ] Retention policy enforced by a scheduled Convex function.
- [ ] ICO registration for the operating entity.
- [ ] Legal Services Act: the product gives information and templates; anything that is legal advice or representation goes through the SRA-regulated partner firm.
- [ ] Debt advice routed to an FCA-authorised provider (for example Citizens Advice).
- [ ] Written authority captured before anyone acts on a client's behalf.
- [ ] Safeguarding policy and escalation route agreed with the advice partner.
- [ ] Accessibility: WCAG 2.2 AA, screen reader pass on iOS and Android, tested with users who have low literacy.

---

## 11. Build plan

### Today, before 15:00 (hackathon demo)

Ordered by impact on the judging criteria. Each is small enough for one person.

1. **Make the AI visible and reliable.** Set `GEMINI_API_KEY` on the Convex deployment (`npx convex env set GEMINI_API_KEY ...`) and confirm `aiGenerated` is true on a test run. Without this, the demo is the fixed form.
2. **Add a "Tell us what's happened" first screen** that calls a new `intake.extract` action and pre-fills `answers` from free text, then shows "We understood:" chips. This single change makes the flow AI-led.
3. **Put an adviser between the decision and the voucher.** `claim` creates a `pending` referral. Add a basic `/adviser` screen with Approve. The voucher appears in the wallet only after approval. Demo it on two devices or two browser tabs.
4. **Remove the AI eligibility override** in `assess` (G2) so the pitch can say "rules decide, AI explains, a person approves".
5. **Add a Leeds Crisis Payment pre-check card** to the result screen with the rule trace and the council's 80% figure.
6. **Add one action plan item:** if the reason is a benefit sanction or change, show "Ask for a mandatory reconsideration by [date]" with a draft letter.
7. **Demo hygiene:** label voucher amounts as illustrative. Keep or bypass the NI sign-in, and if it stays, say in the pitch that the MVP removes it.

### Pilot MVP (8 weeks)

| Week | Deliverable |
|---|---|
| 1 | New schema, auth (anonymous clients, staff), `ctx.auth` everywhere, audit log. |
| 2 | Conversational intake with the step-by-step fallback. Language switch. |
| 3 | Document upload and reading with client confirmation. |
| 4 | Scheme rules (Leeds CRPS, food bank referral, fuel) with traces and tests. |
| 5 | Adviser queue and case view, approve, edit and reject flow. |
| 6 | Action plan, deadline functions, lawyer-reviewed letter templates. |
| 7 | SMS updates, status tracker, retention job, DPIA sign-off. |
| 8 | Accessibility pass, usability testing with 5 to 8 users through the partner, fixes, pilot launch. |

### Testing

- Unit tests for every scheme and deadline function (pure TypeScript, no AI).
- Golden-file tests for AI extraction: 20 or more anonymised example stories and documents with expected structured output. Run on every prompt change.
- An end-to-end demo script with the LS9 persona (single parent on Universal Credit, sanctioned last week, £40 left, prepayment meter on emergency credit).
- Run `npx expo lint` and `npx tsc --noEmit` before every merge, as `AGENTS.md` requires.

---

## 12. Open questions

1. Who is the launch partner: Leeds Citizens Advice, a council Community Hub, or a university law clinic?
2. Real voucher values and who funds them.
3. Gemini or another model for the pilot, and on which tier or contract.
4. Whether Leeds City Council will accept a pre-filled Crisis Payment summary from a partner.
5. Which law firm reviews the letter templates and holds the indemnity cover.
