import { ArrowRight, BookOpen, Building2, ClipboardCheck, FileSearch, HeartHandshake, Leaf, MessageSquareText, Scale, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import Link from 'next/link';

const PRINCIPLES = [
  { icon: Sparkles, title: 'AI reads and drafts', text: 'It turns what people say, and the letters they photograph, into organised facts and plain-English drafts.' },
  { icon: ClipboardCheck, title: 'Rules decide', text: 'Eligibility, deadlines and what needs a lawyer come from published criteria and legislation, with a visible trace.' },
  { icon: UserCheck, title: 'People approve', text: 'A named adviser or lawyer approves anything that leaves the app. Every edit and decision is logged.' },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
          <Leaf className="size-4" /> LegalTech in Leeds Hackathon 2026
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          Legal help that reaches people before the crisis does.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Fewer than 1 in 10 people with a legal problem see a lawyer. Common Counsel gets people in Leeds the crisis support they’re entitled
          to, and Remedy gives small businesses lawyer-checked answers they can afford.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/help/" className="inline-flex h-14 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">
            I need help now <ArrowRight className="size-4" />
          </Link>
          <Link href="/business/" className="inline-flex h-14 items-center gap-2 rounded-xl bg-remedy px-6 font-semibold text-white hover:bg-[#151d31]">
            I run a business <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <article className="flex flex-col rounded-3xl bg-brand p-8 text-white">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/15"><HeartHandshake className="size-6" /></span>
          <h2 className="mt-6 text-3xl font-bold">Common Counsel</h2>
          <p className="mt-2 text-white/85">Food, fuel and crisis support for people in Leeds. Free, no account, any hour.</p>
          <ul className="mt-6 space-y-3 text-white/90">
            <Li icon={MessageSquareText}>Tell us what’s happened in your own words. The AI organises it so you never repeat your story.</Li>
            <Li icon={FileSearch}>Photograph a sanction letter or your meter. We read it, you confirm it.</Li>
            <Li icon={ClipboardCheck}>An honest pre-check against the Leeds Crisis Payment, food bank and fuel criteria.</Li>
            <Li icon={UserCheck}>An adviser approves the referral in one click. Deadlines and draft letters for the root cause.</Li>
          </ul>
          <div className="mt-auto flex flex-wrap gap-3 pt-8">
            <Link href="/help/" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-brand">Get help <ArrowRight className="size-4" /></Link>
            <Link href="/adviser/" className="inline-flex h-11 items-center rounded-xl px-4 font-semibold text-white/90 hover:bg-white/10">Adviser dashboard</Link>
          </div>
        </article>

        <article className="flex flex-col rounded-3xl bg-remedy p-8 text-white">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/15"><Scale className="size-6" /></span>
          <h2 className="mt-6 text-3xl font-bold">Remedy</h2>
          <p className="mt-2 text-white/85">Legal answers for small businesses in England and Wales, checked by a lawyer when it matters.</p>
          <ul className="mt-6 space-y-3 text-white/90">
            <Li icon={BookOpen}>Answers that cite the actual legislation, linked to legislation.gov.uk.</Li>
            <Li icon={ShieldCheck}>Clear flags when something needs legal judgement, then a named lawyer checks it.</Li>
            <Li icon={FileSearch}>Upload a contract or term sheet and see the clauses worth a closer look.</Li>
            <Li icon={Building2}>When you grow, a consented handoff to a partner firm, with the referral fee always shown.</Li>
          </ul>
          <div className="mt-auto flex flex-wrap gap-3 pt-8">
            <Link href="/business/" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 font-semibold text-remedy">Ask Remedy <ArrowRight className="size-4" /></Link>
            <Link href="/lawyer/" className="inline-flex h-11 items-center rounded-xl px-4 font-semibold text-white/90 hover:bg-white/10">Lawyer portal</Link>
            <Link href="/firm/" className="inline-flex h-11 items-center rounded-xl px-4 font-semibold text-white/90 hover:bg-white/10">Firm portal</Link>
          </div>
        </article>
      </section>

      {/* Principles */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold">How it stays safe</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="space-y-2">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><p.icon className="size-5" /></span>
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo guide */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold">Try the demo</h2>
        <p className="mt-2 text-muted">Open two or three tabs side by side. Everything updates live.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Demo
            title="Common Counsel"
            steps={[
              ['Tab 1', '/help/', 'Tap “I have no food”, answer a few questions, then send it to an adviser.'],
              ['Tab 2', '/adviser/', 'Sign in with code LEEDS, open the case and approve the referrals.'],
              ['Tab 1', '/help/wallet/', 'The voucher appears in the wallet.'],
            ]}
          />
          <Demo
            remedy
            title="Remedy"
            steps={[
              ['Tab 1', '/business/', 'Tap Demo, set up Jade Studio Ltd and ask about hiring a freelancer.'],
              ['Tab 2', '/lawyer/', 'Sign in with code REMEDY, edit the AI draft and approve.'],
              ['Tab 3', '/firm/', 'Switch the business to Raising, send a handoff pack, accept it here.'],
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function Li({ icon: Icon, children }: { icon: typeof Leaf; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-white/70" />
      <span>{children}</span>
    </li>
  );
}

function Demo({ title, steps, remedy }: { title: string; steps: [string, string, string][]; remedy?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h3 className={`font-bold ${remedy ? 'text-remedy' : 'text-brand'}`}>{title}</h3>
      <ol className="mt-4 space-y-3">
        {steps.map(([tab, href, text], i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="w-12 shrink-0 font-semibold text-muted">{tab}</span>
            <span>
              <Link href={href} className="font-semibold underline underline-offset-2">{href}</Link> {text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
