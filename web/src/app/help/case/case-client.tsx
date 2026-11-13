'use client';

import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, FileSignature, CloudOff, FileUp, Heart, ListChecks, Loader2, MessageCircle, Send, Sparkles, Trash2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  AiBadge,
  ExitButton,
  FactChips,
  NotAdvice,
  OutcomePill,
  RETAILERS,
  RETAILER_COLORS,
  SchemeCard,
  Timeline,
  VoucherCard,
  type Outcome,
  type Step,
} from '@/components/cc';
import { Container, useIdParam } from '@/components/page';
import { Banner, Button, Card, Pill, Spinner } from '@/components/ui';
import { draftHref, newDraftHref } from '@/lib/drafting';
import { cx, errorMessage, longDate, shortDate } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { factChips } from '@convex/lib/facts';

type CaseView = FunctionReturnType<typeof api.cases.get>;

export default function CaseClient() {
  const caseId = useIdParam<Id<'cases'>>();
  const token = useToken('client');
  const c = useQuery(api.cases.get, token && caseId ? { token, caseId } : 'skip');
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace('/help/');
  }, [token, router]);

  if (!token || c === undefined) return <Spinner label="Loading your case…" />;

  const stage = c.status !== 'draft' ? 'track' : c.assessedAt ? 'result' : 'intake';

  return (
    <Container>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/help/" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> All cases
        </Link>
        <span className="text-sm text-faint">·</span>
        <span className="text-sm text-muted">Started {shortDate(c.createdAt)}</span>
        <div className="ml-auto"><ExitButton /></div>
      </div>
      {c.safeguardingFlag ? (
        <Banner tone="danger" icon={Heart} title="Your safety comes first" className="mb-6">{c.safeguardingFlag}</Banner>
      ) : null}
      {stage === 'intake' ? <Intake c={c} token={token} /> : stage === 'result' ? <Result c={c} token={token} /> : <Track c={c} />}
    </Container>
  );
}

// ---------------- Intake (conversational) ----------------

function Intake({ c, token }: { c: CaseView; token: string }) {
  const router = useRouter();
  const turn = useAction(api.intake.turn);
  const assess = useAction(api.intake.assess);
  const removeFact = useMutation(api.cases.removeFact);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(message: string) {
    if (!message.trim() || thinking) return;
    setError(null);
    setThinking(true);
    setText('');
    try {
      const res = await turn({ token, caseId: c._id, text: message.trim() });
      setAiFailed(res.aiFailed);
      if (res.draftId) router.push(draftHref('client', res.draftId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setThinking(false);
    }
  }

  // First turn: the story typed on the start page.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (c.transcript.length === 0) {
      queueMicrotask(() => {
        if (c.story) send(c.story);
        else turn({ token, caseId: c._id }).catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [c.transcript.length, thinking]);

  async function check() {
    setError(null);
    setChecking(true);
    try {
      await assess({ token, caseId: c._id });
    } catch (err) {
      setError(errorMessage(err));
      setChecking(false);
    }
  }

  if (checking) return <Spinner label="Checking what you can get… running the rules and preparing your summary." />;

  const q = c.nextQuestion;
  const enough = c.intakeDone || c.missing.length <= 2;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section className="flex min-h-[60vh] flex-col rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-6 py-4">
          <h1 className="text-xl font-medium">Tell us more</h1>
          <p className="text-sm text-muted">Answer in your own words, or tap a suggestion.</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5" style={{ maxHeight: '60vh' }}>
          {c.transcript.map((m, i) => (
            <div key={i} className={cx('max-w-[85%] space-y-2', m.role === 'client' && 'ml-auto')}>
              <div className={cx('rounded-xl px-4 py-3', m.role === 'client' ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md border border-line bg-bg')}>{m.text}</div>
              {m.draftId ? (
                <Link href={draftHref('client', m.draftId)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-brand">
                  <FileSignature className="size-5 text-brand" />
                  <span className="flex-1 font-medium">Write the letter with me</span>
                  <ArrowRight className="size-4 text-brand" />
                </Link>
              ) : null}
            </div>
          ))}
          {thinking ? (
            <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-md border border-line bg-bg px-4 py-3 text-muted">
              <Loader2 className="size-4 animate-spin text-brand" /> Reading that…
            </div>
          ) : null}
          <div ref={end} />
        </div>
        <div className="space-y-3 border-t border-line p-4">
          {aiFailed ? (
            <Banner tone="warn" icon={CloudOff} title="Our assistant isn’t responding">You can answer step by step instead. Nothing you’ve said is lost.</Banner>
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {!thinking && q && !c.intakeDone ? (
            <div className="flex flex-wrap gap-2">
              {q.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium hover:border-brand hover:bg-brand-soft">
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {c.intakeDone ? (
            <Button size="lg" className="w-full" icon={CheckCircle2} onClick={check}>Check what I can get</Button>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(text);
                  }
                }}
                rows={1}
                placeholder="Type your answer"
                className="max-h-32 min-h-12 flex-1 resize-none rounded-xl border border-line bg-surface px-4 py-3 focus:border-brand focus:outline-none"
              />
              <button type="submit" aria-label="Send" disabled={!text.trim() || thinking} className="flex size-12 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40">
                <ArrowUp className="size-5" />
              </button>
            </form>
          )}
          <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
            <Link href={`/help/steps/?id=${c._id}`} className="text-brand">Answer step by step instead</Link>
            <Link href={newDraftHref('client', { caseId: c._id })} className="text-brand">Need a letter written?</Link>
            {!c.intakeDone && enough ? (
              <button type="button" onClick={check} className="text-brand">Skip to results</button>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <Card className="space-y-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-brand uppercase"><Sparkles className="size-3.5" /> We understood</p>
          {c.chips.length ? (
            <>
              <FactChips chips={c.chips} onRemove={(key) => removeFact({ token, caseId: c._id, key })} />
              <p className="text-sm text-muted">Something wrong? Tap × and we’ll ask again.</p>
            </>
          ) : (
            <p className="text-sm text-muted">As you answer, what we’ve understood appears here.</p>
          )}
        </Card>
        <Documents c={c} token={token} />
      </aside>
    </div>
  );
}

// ---------------- Documents (upload, AI read, confirm) ----------------

const DOC_KINDS = [
  { id: 'sanction_letter', label: 'Benefits decision or sanction letter' },
  { id: 'uc_statement', label: 'Universal Credit statement' },
  { id: 'meter_photo', label: 'Photo of your meter' },
  { id: 'bank_statement', label: 'Bank statement' },
  { id: 'other', label: 'Something else' },
];

function Documents({ c, token }: { c: CaseView; token: string }) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const add = useMutation(api.documents.add);
  const confirm = useMutation(api.documents.confirm);
  const remove = useMutation(api.documents.remove);
  const [kind, setKind] = useState('sanction_letter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const url = await generateUploadUrl({ token, caseId: c._id });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
      if (!res.ok) throw new Error('upload failed');
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await add({ token, caseId: c._id, storageId, kind });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="font-medium">Add a letter or meter photo</p>
        <p className="text-sm text-muted">Optional. We read it for you, and nothing counts until you say it’s right.</p>
      </div>
      {c.documents.map((d) => {
        const chips = d.extracted ? factChips(d.extracted) : [];
        return (
          <div key={d._id} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex gap-3">
              {d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.url} alt="" className="size-14 shrink-0 rounded-lg bg-bg object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{d.kind.replace(/_/g, ' ')}</p>
                {d.status === 'reading' ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted"><Loader2 className="size-3.5 animate-spin" /> Reading it now…</p>
                ) : (
                  <p className="text-sm text-muted">{d.summary}</p>
                )}
              </div>
            </div>
            {d.status === 'read' && chips.length ? (
              <>
                <FactChips chips={chips} />
                {d.confirmedByClient ? (
                  <Pill tone="brand" icon={CheckCircle2}>You confirmed this</Pill>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" icon={CheckCircle2} onClick={() => confirm({ token, docId: d._id, facts: d.extracted ?? {} })}>Yes, that’s right</Button>
                    <Button size="sm" variant="danger" onClick={() => remove({ token, docId: d._id })}>No</Button>
                  </div>
                )}
              </>
            ) : d.status !== 'reading' ? (
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove({ token, docId: d._id })}>Remove</Button>
            ) : null}
          </div>
        );
      })}
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm">
        {DOC_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button variant="secondary" className="w-full" icon={FileUp} loading={busy} onClick={() => input.current?.click()}>Choose a photo or PDF</Button>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <p className="text-xs text-muted">Cover any account numbers if you can. We never read names, addresses or NI numbers.</p>
    </Card>
  );
}

// ---------------- Result (pre-check) ----------------

function Result({ c, token }: { c: CaseView; token: string }) {
  const submit = useMutation(api.cases.submit);
  const setRetailer = useMutation(api.cases.setRetailer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const worthSending = c.eligibility.filter((e) => e.outcome !== 'unlikely');
  const food = c.eligibility.find((e) => e.scheme === 'food_bank_referral' && e.outcome !== 'unlikely');
  const retailer = c.retailer ?? 'Tesco';

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await submit({ token, caseId: c._id });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section className="space-y-5">
        <div className="space-y-3">
          <AiBadge />
          <h1 className="font-serif text-3xl font-normal tracking-tight">{worthSending.length ? 'Here’s what you could get' : 'We couldn’t find a match this time'}</h1>
          {c.clientSummary ? <p className="text-base leading-relaxed text-muted">{c.clientSummary}</p> : null}
        </div>
        {c.eligibility.map((e) => (
          <SchemeCard
            key={e._id}
            name={e.info?.name ?? e.scheme}
            who={e.info?.who}
            contact={e.info?.contact}
            outcome={e.outcome as Outcome}
            explanation={e.explanation}
            toFinish={e.toFinish}
            trace={e.trace}
            note={
              e.scheme === 'leeds_crisis_payment'
                ? 'Leeds City Council says it refuses about 80% of applications because the criteria aren’t met. This check helps you apply only when it’s worth it. The council makes the decision.'
                : undefined
            }
          />
        ))}
        {food ? (
          <Card className="space-y-3">
            <div>
              <p className="font-medium">If food help is approved, where would you like to shop?</p>
              <p className="text-sm text-muted">Demo: an approved referral shows as a supermarket e-voucher in your wallet.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RETAILERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRetailer({ token, caseId: c._id, retailer: r })}
                  className={cx('flex items-center gap-2 rounded-xl border p-2.5 text-sm font-medium', r === retailer ? 'border-current' : 'border-line')}
                  style={r === retailer ? { color: RETAILER_COLORS[r], backgroundColor: `${RETAILER_COLORS[r]}12` } : undefined}>
                  <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: RETAILER_COLORS[r] }}>{r[0]}</span>
                  <span className="text-ink">{r}</span>
                </button>
              ))}
            </div>
          </Card>
        ) : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <div className="flex flex-wrap gap-3">
          {worthSending.length ? (
            <Button size="lg" icon={Send} loading={busy} onClick={send}>Send to an adviser</Button>
          ) : null}
          <Link href={`/help/plan/?id=${c._id}`} className="inline-flex h-14 items-center gap-2 rounded-xl px-6 font-medium text-brand hover:bg-brand-soft">
            <ListChecks className="size-4" /> Your action plan
          </Link>
        </div>
        <NotAdvice />
      </section>
      <aside className="space-y-6">
        <Card className="space-y-3">
          <p className="text-[11px] font-medium tracking-wider text-muted uppercase">Based on</p>
          <FactChips chips={c.chips} />
          <Link href={`/help/steps/?id=${c._id}`} className="text-sm font-medium text-brand">Change my answers</Link>
        </Card>
        <PlanTeaser c={c} />
        <Documents c={c} token={token} />
      </aside>
    </div>
  );
}

function PlanTeaser({ c }: { c: CaseView }) {
  if (!c.actions.length) return null;
  const first = c.actions.find((a) => a.deadline);
  return (
    <Link href={`/help/plan/?id=${c._id}`} className="block rounded-xl border border-line bg-warn-soft p-5 hover:border-warn">
      <p className="font-medium">Sorting out the cause</p>
      <p className="mt-1 text-sm">
        {first?.deadline ? `${first.title}: by ${longDate(first.deadline)}` : `${c.actions.length} thing${c.actions.length === 1 ? '' : 's'} to sort out the cause`}
      </p>
      <p className="mt-2 text-sm font-medium text-warn">See your action plan →</p>
    </Link>
  );
}

// ---------------- Track ----------------

const REFERRAL_STATUS: Record<string, string> = {
  pending: 'Waiting for an adviser',
  approved: 'Approved',
  sent: 'Approved and sent',
  rejected: 'Not approved',
};

function Track({ c }: { c: CaseView }) {
  const decided = c.referrals.length > 0 && c.referrals.every((r) => r.status !== 'pending');
  const anyApproved = c.referrals.some((r) => r.status === 'approved' || r.status === 'sent');
  const reviewing = c.status === 'in_review' || decided;
  const steps: Step[] = [
    { label: 'Sent to an adviser', detail: c.submittedAt ? shortDate(c.submittedAt) : undefined, state: 'done' },
    { label: 'Adviser checking', detail: 'They check your answers and documents', state: reviewing ? 'done' : 'current' },
    { label: decided ? (anyApproved ? 'Approved' : 'Decision made') : 'Decision', detail: decided ? undefined : 'Usually the same day', state: decided ? 'done' : reviewing ? 'current' : 'todo' },
    { label: 'Referral sent', detail: anyApproved ? 'To the food bank, council or fuel partner' : undefined, state: anyApproved ? 'done' : 'todo' },
    { label: 'Ready to use', detail: c.vouchers.length ? 'Your vouchers are in your wallet' : undefined, state: c.vouchers.length ? 'done' : 'todo' },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-normal tracking-tight">{decided ? (anyApproved ? 'Your help is approved' : 'An adviser has looked at your case') : 'An adviser is on it'}</h1>
          <p className="text-base leading-relaxed text-muted">{decided ? 'Here’s what was decided.' : 'You don’t need to explain everything again. Your summary has been sent with your case.'}</p>
        </div>
        {c.adviserMessage ? <Banner tone="info" icon={MessageCircle} title="Message from your adviser">{c.adviserMessage}</Banner> : null}
        {c.vouchers.length ? (
          <div className="space-y-3">
            <AiBadge approved />
            <div className="grid gap-4 sm:grid-cols-2">
              {c.vouchers.map((v) => <VoucherCard key={v._id} voucher={v} href={`/help/wallet/?v=${v._id}`} />)}
            </div>
            <Link href="/help/wallet/" className="inline-flex items-center gap-2 font-medium text-brand"><Wallet className="size-4" /> Open my wallet</Link>
          </div>
        ) : null}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-ink">Referrals</h2>
          {c.referrals.map((r) => {
            const e = c.eligibility.find((x) => x.scheme === r.scheme);
            return (
              <Card key={r._id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="flex-1 font-medium">{r.info?.name ?? r.scheme}</p>
                  {e ? <OutcomePill outcome={e.outcome as Outcome} /> : null}
                </div>
                <p className={cx('text-sm font-medium', r.status === 'rejected' ? 'text-danger' : r.status === 'pending' ? 'text-muted' : 'text-brand')}>{REFERRAL_STATUS[r.status]}</p>
                {r.status === 'rejected' && r.reason ? <p className="text-sm text-muted">Reason: {r.reason}</p> : null}
                {r.status === 'sent' && r.scheme === 'leeds_crisis_payment' ? (
                  <p className="text-sm text-muted">Your pre-filled application is ready. Leeds City Council makes the final decision.</p>
                ) : null}
              </Card>
            );
          })}
        </div>
        <NotAdvice />
      </section>
      <aside className="space-y-6">
        <Card><Timeline steps={steps} /></Card>
        <PlanTeaser c={c} />
      </aside>
    </div>
  );
}
