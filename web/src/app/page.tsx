import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const PRINCIPLES = [
  {
    num: '01',
    title: 'AI organises and drafts',
    text: 'Turns spoken stories and photographed letters into structured facts and plain-English drafts.',
  },
  {
    num: '02',
    title: 'Rules decide',
    text: 'Eligibility, deadlines and escalation flags come from published criteria and legislation, with a visible trace.',
  },
  {
    num: '03',
    title: 'People approve',
    text: 'A named adviser or lawyer approves anything that leaves the app. Every edit and decision is logged.',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="border-b border-line pt-16 pb-16 sm:pt-24 sm:pb-20">
        <p className="text-xs font-medium tracking-wider text-muted uppercase">
          LegalTech in Leeds · 2026
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl font-normal tracking-tight text-balance sm:text-6xl sm:leading-[1.08]">
          Legal help that reaches people before the crisis does.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Fewer than one in ten people with a legal problem see a lawyer. Common Counsel gets people in Leeds the crisis support they are entitled to, and Remedy gives small businesses lawyer-checked answers they can afford.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/help/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark">
            I need help now <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/business/"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors hover:border-faint">
            I run a business <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Two Services */}
      <section className="grid border-b border-line lg:grid-cols-2 lg:divide-x lg:divide-line">
        <article className="flex flex-col py-12 lg:pr-12">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-brand uppercase">
            <span className="size-1.5 rounded-full bg-brand" /> For individuals in Leeds
          </div>
          <h2 className="mt-3 font-serif text-3xl font-normal tracking-tight">Common Counsel</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Food, fuel and crisis support for people in Leeds. Free, no account required, available at any hour.
          </p>
          <ul className="mt-8 space-y-4 border-t border-line pt-6 text-sm text-ink">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">01</span>
              <span>Tell us what happened in your own words so you never have to repeat your story.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">02</span>
              <span>Photograph a sanction letter or meter. We extract the details; you confirm them.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">03</span>
              <span>Instant pre-check against Leeds Crisis Payment, food bank and fuel criteria.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">04</span>
              <span>An adviser approves referrals in one click, with deadlines and draft letters for the root cause.</span>
            </li>
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-6 pt-8 text-sm">
            <Link href="/help/" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
              Start a check <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/adviser/" className="text-muted hover:text-ink">
              Adviser queue
            </Link>
          </div>
        </article>

        <article className="flex flex-col border-t border-line py-12 lg:border-t-0 lg:pl-12">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-remedy uppercase">
            <span className="size-1.5 rounded-full bg-remedy" /> For small businesses
          </div>
          <h2 className="mt-3 font-serif text-3xl font-normal tracking-tight">Remedy</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Practical legal answers for small businesses in England and Wales, checked by a named lawyer when it matters.
          </p>
          <ul className="mt-8 space-y-4 border-t border-line pt-6 text-sm text-ink">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">01</span>
              <span>Answers grounded in primary legislation, linked directly to legislation.gov.uk.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">02</span>
              <span>Automatic flags when an issue requires legal judgement, routed to a named lawyer.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">03</span>
              <span>Contract and term sheet review that highlights clauses needing closer attention.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-faint">04</span>
              <span>Consented handoff to a partner law firm as you grow, with transparent referral fees.</span>
            </li>
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-6 pt-8 text-sm">
            <Link href="/business/" className="inline-flex items-center gap-1.5 font-medium text-remedy hover:underline">
              Open Remedy <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/lawyer/" className="text-muted hover:text-ink">
              Lawyer portal
            </Link>
            <Link href="/firm/" className="text-muted hover:text-ink">
              Partner firm portal
            </Link>
          </div>
        </article>
      </section>

      {/* Architecture / Safety */}
      <section className="border-b border-line py-14">
        <p className="text-xs font-medium tracking-wider text-muted uppercase">Architecture</p>
        <h2 className="mt-2 font-serif text-2xl font-normal tracking-tight">How it stays safe</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="space-y-2">
              <p className="font-mono text-xs text-faint">{p.num}</p>
              <h3 className="text-base font-medium text-ink">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Walkthrough */}
      <section className="py-14">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
          <h2 className="font-serif text-2xl font-normal tracking-tight">Live demo guide</h2>
          <p className="text-xs text-muted">Open tabs side by side — state syncs in real time.</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Demo
            title="Common Counsel"
            steps={[
              ['01', '/help/', 'Select “I have no food”, answer a few questions, and send to an adviser.'],
              ['02', '/adviser/', 'Sign in with code LEEDS, open the case, and approve the referrals.'],
              ['03', '/help/wallet/', 'The approved e-voucher appears immediately in the client wallet.'],
            ]}
          />
          <Demo
            title="Remedy"
            steps={[
              ['01', '/business/', 'Click Demo to fill Jade Studio Ltd, and ask about hiring a freelancer.'],
              ['02', '/lawyer/', 'Sign in with code REMEDY, review the AI draft, and approve.'],
              ['03', '/firm/', 'Switch the business stage to Raising, send a handoff pack, and accept it here.'],
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function Demo({ title, steps }: { title: string; steps: [string, string, string][] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ol className="mt-4 divide-y divide-line">
        {steps.map(([num, href, text]) => (
          <li key={num} className="flex gap-4 py-3 first:pt-0 last:pb-0 text-sm">
            <span className="font-mono text-xs text-faint mt-0.5">{num}</span>
            <span className="text-muted">
              <Link href={href} className="font-mono text-xs font-medium text-ink underline underline-offset-2">{href}</Link>{' '}
              {text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
