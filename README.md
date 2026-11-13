# Common Counsel — food & energy voucher prototype

Expo (SDK 58, Expo Router) + Convex + Gemini. Built for the LegalTech in Leeds Hackathon. Nothing here is real: no identity checks, no real vouchers.

## Flow

1. **Sign in** with first name, National Insurance number and date of birth (format check only; try `QQ 12 34 56 C`).
2. **Check**: 9 questions modelled on food bank referral and Household Support Fund forms (household, reasons, benefits, income, food left, cooking, diet, energy, own words).
3. **AI follow-ups**: Gemini (lite) asks up to 2 tailored questions with tap-to-answer chips.
4. **Decision**: fixed rules (`convex/lib/policy.ts`) set eligibility, voucher values and the 3-per-6-months limit. Gemini can only *add* eligibility, and writes the explanation, other help, any safety notice and an adviser case note.
5. **Claim**: pick a supermarket. A food e-voucher (30 days), plus an energy top-up voucher (90 days) for people who can't top up their meter.
6. **Wallet**: active / used / expired vouchers, with QR code, code, PIN, validity and "mark as used".

## Run

```bash
npm install
npx convex dev            # backend; first run sets up .env.local
npx convex env set GEMINI_API_KEY <key>
npx expo start            # i = iOS simulator, w = web
```

The current setup uses an anonymous **local** Convex backend (`127.0.0.1:3210`). That works for web, the iOS simulator and the Android emulator, but **not a physical phone**. For Expo Go on a phone, run `npx convex login` then `npx convex dev` to create a cloud dev deployment, and set `GEMINI_API_KEY` there.

## Where things live

- `convex/lib/questions.ts`: questions and options (shared by app and backend)
- `convex/lib/policy.ts`: eligibility rules and voucher amounts
- `convex/assessments.ts`: Gemini follow-ups and assessment
- `convex/vouchers.ts`: issue, list, mark used, reset demo
- `src/app/`: screens (`sign-in`, `(app)/home`, `check`, `result/[id]`, `wallet`, `voucher/[id]`)
- `src/components/ui.tsx`: design system bits
