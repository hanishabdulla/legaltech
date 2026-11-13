'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  FileText,
  Lock,
  LogOut,
  MessagesSquare,
  Minus,
  Palette,
  Plus,
  Send,
  Store,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Container } from '@/components/page';
import { BusinessNotice, FlagChips, SECTORS, STAGES, StatusBadge, TOPIC_LABELS, sectorLabel, type Stage } from '@/components/remedy';
import { Banner, Button, Card, Check, Chip, Empty, Field, Input, Option, Progress, Spinner, Textarea } from '@/components/ui';
import { draftHref, newDraftHref } from '@/lib/drafting';
import { errorMessage, shortDate } from '@/lib/format';
import { looksLikeDraftRequest } from '@convex/lib/drafting/templates';
import { setToken, useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';

const TOPICS = [
  { icon: Users, label: 'Hiring', text: 'Can I take on a freelancer for 3 days a week without making them an employee?' },
  { icon: FileText, label: 'Contracts', text: 'A client wants me to sign their contract. What should I look out for?' },
  { icon: Banknote, label: 'Getting paid', text: 'A client is 45 days late paying a £4,000 invoice. What can I do?' },
  { icon: Lock, label: 'Data', text: 'Do I need consent to add customers to my email newsletter?' },
  { icon: Palette, label: 'IP', text: 'Who owns the logo a freelance designer made for us?' },
  { icon: Store, label: 'Premises', text: 'Our landlord wants to end our office lease. Do we have a right to stay?' },
];

export default function BusinessPage() {
  const token = useToken('business');
  const me = useQuery(api.business.me, token ? { token } : 'skip');

  useEffect(() => {
    if (token && me === null) setToken('business', null);
  }, [token, me]);

  if (token === undefined || (token && me === undefined)) return <Spinner />;
  if (!token || !me) return <Start />;
  return <Dashboard token={token} me={me} />;
}

// ---------------- Sign up ----------------

const PRIVACY = [
  'Remedy’s AI reads your question and the legislation, and drafts an answer. Rules, not the AI, decide what a lawyer must check. A named Remedy lawyer approves anything flagged before it counts as checked.',
  'Unchecked answers are general information about the law in England and Wales, not legal advice.',
  'Lawyer-checked answers are given by solicitors working outside a law firm under SRA rules. Some protections differ: for example there is no compulsory professional indemnity cover through Remedy, and what you tell us may not be covered by legal privilege.',
  'We only share anything with a partner law firm if you choose the firm and tick what to share. Remedy receives a referral fee, which is always shown.',
  'The AI never sees your business name or company number unless it needs them. You can delete your data at any time.',
];

function Start() {
  const start = useMutation(api.business.start);
  const [name, setName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [sector, setSector] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState('');
  const [stage, setStage] = useState<Stage>('trading');
  const [region, setRegion] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!region) return setError('Remedy only covers businesses in England and Wales for now.');
    if (!sector) return setError('Please choose a sector.');
    setBusy(true);
    try {
      const token = await start({ name, companyNumber: companyNumber.trim() || undefined, sector, headcount: Number(headcount) || 0, stage, region: 'england_wales', consent });
      setToken('business', token);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Container>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-5 lg:pt-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-remedy-soft px-3 py-1 text-sm font-medium text-remedy">Remedy · for small businesses</p>
          <h1 className="font-serif text-4xl font-normal tracking-tight text-balance sm:text-5xl">Legal answers you can act on.</h1>
          <p className="text-base leading-relaxed text-muted">Answers from the legislation, with sources. A named lawyer checks anything that needs judgement.</p>
          <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <h2 className="font-medium">How Remedy works</h2>
            <ul className="space-y-2 text-sm text-muted">
              {PRIVACY.map((p) => <li key={p} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-remedy" />{p}</li>)}
            </ul>
          </div>
        </section>

        <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-normal tracking-tight">Tell us about your business</h2>
              <p className="text-muted">So we answer with the right law. Takes a minute.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => { setName('Jade Studio Ltd'); setSector('creative'); setHeadcount('3'); setStage('trading'); }}>Demo</Button>
          </div>
          <Field label="Business name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jade Studio Ltd" /></Field>
          <Field label="Company number (optional)"><Input value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="8 characters, e.g. 12345678" /></Field>
          <div className="space-y-2">
            <p className="font-medium">Sector</p>
            <div className="flex flex-wrap gap-2">{SECTORS.map((s) => <Chip key={s.id} selected={sector === s.id} onClick={() => setSector(s.id)}>{s.label}</Chip>)}</div>
          </div>
          <Field label="How many people work in the business?"><Input inputMode="numeric" value={headcount} onChange={(e) => setHeadcount(e.target.value.replace(/\D/g, ''))} placeholder="Including you" /></Field>
          <div className="space-y-2">
            <p className="font-medium">Stage</p>
            <div className="grid gap-2 sm:grid-cols-3">{STAGES.map((s) => <Option key={s.id} label={s.label} hint={s.hint} selected={stage === s.id} onClick={() => setStage(s.id)} />)}</div>
          </div>
          <Check label="The business is in England or Wales" hint="Remedy doesn’t cover Scottish or Northern Irish law yet." checked={region} onChange={setRegion} />
          <Check label="I’ve read how Remedy works and agree to Remedy storing my business details and questions." checked={consent} onChange={setConsent} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button type="submit" size="lg" variant="remedy" className="w-full" icon={ArrowRight} loading={busy} disabled={!name.trim() || !consent}>Set up my business</Button>
          <p className="text-center text-xs text-muted">Prototype with demo data only. No real legal advice, referrals or firms.</p>
        </form>
      </div>
    </Container>
  );
}

// ---------------- Dashboard ----------------

type Me = NonNullable<FunctionReturnType<typeof api.business.me>>;

function Dashboard({ token, me }: { token: string; me: Me }) {
  const matters = useQuery(api.matters.mine, { token });
  const suggestions = useQuery(api.firms.suggestions, { token });
  const ask = useMutation(api.matters.ask);
  const drafts = useQuery(api.drafting.mine, { kind: 'business', token });
  const deleteMyData = useMutation(api.business.deleteMyData);
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const matterId = await ask({ token, question });
      router.push(`/business/matter/?id=${matterId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function wipe() {
    if (!window.confirm('Delete my data?\n\nThis permanently deletes your business profile, questions, documents and referrals.')) return;
    await deleteMyData({ token }).catch(() => {});
    setToken('business', null);
  }

  const trigger = suggestions?.trigger;
  const activeReferral = suggestions?.referrals.find((r) => r.status !== 'declined');

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-remedy uppercase">Remedy · {me.plan === 'pro' ? 'Pro' : 'Starter'} plan</p>
          <h1 className="font-serif text-3xl font-normal tracking-tight">{me.name}</h1>
          <p className="text-muted">{sectorLabel(me.sector)} · {me.headcount} staff</p>
        </div>
        <Button variant="outline" icon={LogOut} onClick={() => setToken('business', null)}>Sign out</Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          {trigger && !activeReferral ? (
            <Link href="/business/firms/" className="flex items-center gap-4 rounded-r-xl border-l-2 border-remedy bg-remedy-soft px-5 py-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Time to bring in a law firm?</p>
                <p className="text-sm text-muted">{trigger.reason}</p>
              </div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ) : null}
          {activeReferral ? (
            <Link href="/business/firms/" className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
              {activeReferral.status === 'accepted' ? <CheckCircle2 className="size-6 text-brand" /> : <Send className="size-6 text-brand" />}
              <div className="flex-1">
                <p className="font-medium">{activeReferral.firm}</p>
                <p className="text-sm text-muted">{activeReferral.status === 'accepted' ? `Accepted · your contact is ${activeReferral.firmContact}` : 'Handoff pack sent · waiting for the firm'}</p>
              </div>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          ) : null}

          <section className="space-y-3 rounded-xl border border-line bg-surface p-6">
            <h2 className="font-serif text-2xl font-normal tracking-tight">What’s the issue?</h2>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Describe it in plain English, like you would to a friend who’s a lawyer." className="min-h-32 text-lg" />
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button key={t.label} type="button" onClick={() => setQuestion(t.text)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-remedy hover:bg-remedy-soft">
                  <t.icon className="size-4 text-remedy" /> {t.label}
                </button>
              ))}
            </div>
            {looksLikeDraftRequest(question) ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-remedy-soft p-4">
                <FileSignature className="size-5 text-remedy" />
                <p className="flex-1 text-sm font-medium">Sounds like you need a document drafted. Remedy can ask a few questions and make the PDF.</p>
                <Link href={newDraftHref('business', { text: question })} className="rounded-lg bg-remedy px-3 py-2 text-sm font-medium text-white">Draft it</Link>
              </div>
            ) : null}
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Button size="lg" variant="remedy" icon={ArrowRight} onClick={submit} loading={busy} disabled={question.trim().length < 8}>Ask Remedy</Button>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">Documents</h2>
              <Link href={newDraftHref('business')} className="inline-flex items-center gap-1.5 rounded-xl bg-remedy px-3 py-2 text-sm font-medium text-white"><FileSignature className="size-4" /> Draft a document</Link>
            </div>
            {drafts?.length ? (
              drafts.map((d) => (
                <Link key={d._id} href={draftHref('business', d._id)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-faint">
                  <FileText className="size-5 shrink-0 text-remedy" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-sm text-muted">{d.status === 'generated' ? `PDF ready · version ${d.version}` : 'In progress'} · {d.ref}</p>
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted">NDAs, freelancer agreements and letters before action for unpaid invoices, drafted in a short chat.</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink">Your matters</h2>
            {matters === undefined ? (
              <Spinner className="py-6" />
            ) : matters.length === 0 ? (
              <Empty icon={MessagesSquare} title="No questions yet" text="Ask anything about hiring, contracts, getting paid, data, IP or premises." />
            ) : (
              matters.map((m) => (
                <Card key={m._id} onClick={() => router.push(`/business/matter/?id=${m._id}`)} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={m.status} />
                    <span className="text-sm text-muted">{TOPIC_LABELS[m.topic] ?? m.topic} · {m.ref}</span>
                    <span className="ml-auto text-sm text-muted">{shortDate(m.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 font-medium">{m.question}</p>
                  <FlagChips codes={m.flagCodes} />
                </Card>
              ))
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <Profile token={token} me={me} />
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/business/firms/" className="text-remedy underline underline-offset-2">Partner firms</Link>
            <button type="button" onClick={wipe} className="text-danger underline underline-offset-2">Delete my data</button>
          </div>
          <BusinessNotice />
        </aside>
      </div>
    </Container>
  );
}

/** Switching stage to "raising" updates the traction score live. */
function Profile({ token, me }: { token: string; me: Me }) {
  const update = useMutation(api.business.updateProfile);
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: Partial<{ stage: Stage; headcount: number }>) => {
    setError(null);
    try {
      await update({ token, name: me.name, companyNumber: me.companyNumber, sector: me.sector, headcount: me.headcount, stage: me.stage, ...patch });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const score = me.traction?.score ?? 0;
  const threshold = me.traction?.threshold ?? 60;

  return (
    <Card className="space-y-5">
      <h2 className="text-sm font-medium text-ink">Your business</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted">Stage</p>
        <div className="flex flex-wrap gap-2">{STAGES.map((s) => <Chip key={s.id} selected={me.stage === s.id} onClick={() => save({ stage: s.id })}>{s.label}</Chip>)}</div>
      </div>
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted">Team size</p>
        <button type="button" aria-label="Fewer staff" onClick={() => me.headcount > 1 && save({ headcount: me.headcount - 1 })} className="rounded-full p-1.5 hover:bg-bg"><Minus className="size-4" /></button>
        <span className="w-6 text-center font-medium">{me.headcount}</span>
        <button type="button" aria-label="More staff" onClick={() => save({ headcount: me.headcount + 1 })} className="rounded-full p-1.5 hover:bg-bg"><Plus className="size-4" /></button>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span className="text-muted">Growth score</span><span className="font-medium">{score} / 100</span></div>
        <Progress value={score / 100} />
        <p className="text-sm text-muted">
          {score >= threshold ? 'You’re growing fast. Remedy will suggest a partner law firm for the bigger work.' : `At ${threshold}, Remedy suggests a partner law firm. Raising investment or uploading a term sheet counts.`}
        </p>
        {me.traction?.signals.length ? (
          <div className="flex flex-wrap gap-1.5">
            {me.traction.signals.map((s) => <span key={s.signal} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">+{s.points} {s.signal}</span>)}
          </div>
        ) : null}
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Card>
  );
}
