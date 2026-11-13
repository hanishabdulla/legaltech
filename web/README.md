# Common Counsel · Remedy website (Next.js)

A desktop-first website for both products, built with Next.js 16 (App Router), Tailwind CSS 4 and lucide icons. It talks to the **same Convex backend** as the Expo app (`../convex`), so a case started on the phone app shows up live on the website and vice versa.

| Route | What |
|---|---|
| `/` | Landing page for both products, with a demo guide |
| `/help/` | Common Counsel: "What's happened?", language, consent, your cases, delete my data |
| `/help/case/?id=` | One page per case: AI intake chat → pre-check results → status tracker, with document upload |
| `/help/steps/?id=` | Step-by-step fallback |
| `/help/plan/?id=` | Action plan (deadlines, draft letter, handoffs) |
| `/help/wallet/` | Vouchers with QR code, PIN, validity |
| `/adviser/`, `/adviser/case/?id=` | Adviser queue and two-column case review (code `LEEDS`) |
| `/business/` | Remedy sign-up, then dashboard: ask, matters, growth score |
| `/business/matter/?id=` | Answer with citations, flags, messages, contract upload with clause highlights |
| `/business/firms/` | Partner firms, consent checklist, referral fee shown |
| `/lawyer/`, `/lawyer/matter/?id=` | Lawyer queue with service-level timers; matter summary + edit/approve (code `REMEDY`) |
| `/firm/`, `/firm/referral/?id=` | Partner firm inbox and handoff pack (code `REMEDY`) |

IDs are query parameters (not path segments) so the site is a pure static export that any static host can serve.

## Run

```bash
cd web
npm install
echo "NEXT_PUBLIC_CONVEX_URL=https://brilliant-octopus-164.convex.cloud" > .env.local   # dev deployment
npm run dev        # http://localhost:3000
npm run build      # static site in web/out
```

Shared code comes straight from `../convex` (`@convex/_generated/api`, `@convex/lib/facts`, `@convex/lib/questions`); `turbopack.root` is the repo root to allow that. Sessions are demo tokens in `localStorage` (same keys as the Expo app).

The production Convex deployment currently has Common Counsel only. Deploy the Remedy backend (`npx convex deploy`, then `npx convex run --prod seed:run`) before pointing a production build at it.
