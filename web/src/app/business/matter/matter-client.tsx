'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft, Building2, ChevronRight, FileUp, Flag, Hourglass, Info, Loader2, MessageCircle, Send, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Container, useIdParam } from '@/components/page';
import { BusinessNotice, Citations, FLAG_LABELS, RISK, StatusBadge, TOPIC_LABELS } from '@/components/remedy';
import { Banner, Button, Chip, Pill, Spinner, Textarea } from '@/components/ui';
import { cx, dateTime, errorMessage } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Matter = FunctionReturnType<typeof api.matters.get>;

export default function MatterClient() {
  const matterId = useIdParam<Id<'matters'>>();
  const token = useToken('business');
  const m = useQuery(api.matters.get, token && matterId ? { token, matterId } : 'skip');
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace('/business/');
  }, [token, router]);

  if (!token || m === undefined) return <Spinner />;

  return (
    <Container>
      <Link href="/business/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> All matters</Link>
      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={m.status} checkedBy={m.checkedBy} />
          <span className="text-sm text-muted">{TOPIC_LABELS[m.topic] ?? m.topic} · {m.ref} · {dateTime(m.createdAt)}</span>
        </div>
        <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight">{m.question}</h1>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
        <Answer m={m} token={token} />
        <Documents m={m} token={token} />
      </div>
    </Container>
  );
}

function Answer({ m, token }: { m: Matter; token: string }) {
  const reply = useMutation(api.matters.reply);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = !!m.finalAnswer && !!m.checkedBy;
  const flagged = m.flags.length > 0;
  const lawyerAsk = [...m.messages].reverse().find((x) => x.from === 'lawyer');

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await reply({ token, matterId: m._id, text });
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {m.status === 'answering' ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-12 text-center">
          <Loader2 className="size-6 animate-spin text-remedy" />
          <p className="font-semibold">Reading the legislation…</p>
          <p className="max-w-sm text-sm text-muted">Remedy is finding the relevant sections and drafting an answer. This takes a few seconds.</p>
        </div>
      ) : null}

      {m.status === 'awaiting_client' && lawyerAsk ? (
        <div className="space-y-3 rounded-2xl border-[1.5px] border-danger bg-surface p-5">
          <p className="inline-flex items-center gap-2 font-semibold"><MessageCircle className="size-5 text-danger" /> {lawyerAsk.name ?? 'Our lawyer'} needs a bit more information</p>
          <p>{lawyerAsk.text}</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer…" />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button variant="remedy" icon={Send} onClick={send} loading={busy} disabled={!text.trim()}>Send reply</Button>
        </div>
      ) : null}

      {checked ? (
        <article className="space-y-4 rounded-2xl border-[1.5px] border-brand bg-surface p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="size-5 text-brand" />
            <p className="flex-1 font-semibold text-brand">Checked by {m.checkedBy}, Remedy lawyer</p>
            {m.checkedAt ? <span className="text-sm text-muted">{dateTime(m.checkedAt)}</span> : null}
          </div>
          <p className="leading-relaxed whitespace-pre-wrap">{m.finalAnswer}</p>
          {m.draft ? <Citations citations={m.draft.citations} /> : null}
          <p className="text-sm text-muted">
            Given by a solicitor working outside a law firm under SRA rules. Some protections differ, for example there is no compulsory professional indemnity cover through Remedy, and this may not be covered by legal privilege.
          </p>
        </article>
      ) : null}

      {!checked && m.draft && m.status !== 'answering' ? (
        <article className={cx('space-y-4 rounded-2xl border bg-surface p-6', flagged ? 'border-[1.5px] border-warn' : 'border-line')}>
          <p className="inline-flex items-center gap-2 font-semibold text-info"><Sparkles className="size-4" /> {flagged ? 'AI draft · our lawyer is checking this' : 'AI answer'}</p>
          <p className="leading-relaxed whitespace-pre-wrap">{m.draft.answer}</p>
          {m.draft.nextStep ? (
            <div className="rounded-xl bg-bg p-4">
              <p className="text-xs font-bold tracking-wider text-muted uppercase">Next step</p>
              <p className="text-sm">{m.draft.nextStep}</p>
            </div>
          ) : null}
          <Citations citations={m.draft.citations} />
          <Banner tone={flagged ? 'warn' : 'info'} icon={flagged ? Hourglass : Info}>
            {flagged
              ? 'Our lawyer is checking this. Don’t rely on it until it shows “Lawyer-checked”.'
              : 'General information about the law in England and Wales, not legal advice. Ask a follow-up if your situation is different.'}
          </Banner>
        </article>
      ) : null}

      {!m.draft && !checked && m.status !== 'answering' ? (
        <Banner tone="info" icon={UserRound} title="A lawyer will answer this">Remedy couldn’t give a reliable answer from the legislation, so a Remedy lawyer will write one for you.</Banner>
      ) : null}

      {flagged && m.status !== 'answering' ? (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-bold">What needs a lawyer, and why</h2>
          {m.flags.map((f) => (
            <div key={f.code} className="space-y-0.5 border-t border-line pt-3 first-of-type:border-0 first-of-type:pt-0">
              <p className="inline-flex items-center gap-1.5 font-semibold"><Flag className="size-4 text-warn" /> {FLAG_LABELS[f.code] ?? f.code}</p>
              <p className="text-sm text-muted">{f.reason}</p>
            </div>
          ))}
        </section>
      ) : null}

      {m.status === 'referral_suggested' ? (
        <Link href="/business/firms/" className="flex items-center gap-4 rounded-2xl bg-remedy-soft p-5">
          <Building2 className="size-6 text-remedy" />
          <div className="flex-1">
            <p className="font-semibold">Our lawyer recommends a partner firm</p>
            <p className="text-sm text-muted">See the suggested firms and choose what to share.</p>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </Link>
      ) : null}

      {m.messages.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Messages</h2>
          {m.messages.map((x) => (
            <div key={x._id} className={cx('max-w-[90%] rounded-2xl p-3 text-sm', x.from === 'client' ? 'ml-auto bg-brand-soft' : 'border border-line bg-surface')}>
              <p className="text-muted">{x.from === 'client' ? 'You' : `${x.name ?? 'Lawyer'} · Remedy`} · {dateTime(x.at)}</p>
              <p>{x.text}</p>
            </div>
          ))}
        </section>
      ) : null}
      <BusinessNotice />
    </div>
  );
}

const KINDS = [
  { id: 'contract', label: 'Contract' },
  { id: 'term_sheet', label: 'Term sheet' },
  { id: 'shareholders_agreement', label: 'Shareholders’ agreement' },
  { id: 'lease', label: 'Lease' },
  { id: 'other', label: 'Other' },
];

function Documents({ m, token }: { m: Matter; token: string }) {
  const generateUploadUrl = useMutation(api.contracts.generateUploadUrl);
  const add = useMutation(api.contracts.add);
  const remove = useMutation(api.contracts.remove);
  const submit = useMutation(api.contracts.submit);
  const [kind, setKind] = useState('contract');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = m.documents.filter((d) => !d.submitted);
  const reading = pending.some((d) => d.status === 'reading');
  const canAdd = m.status !== 'answering' && m.status !== 'closed';

  async function upload(file: File) {
    setError(null);
    setBusy('upload');
    try {
      const url = await generateUploadUrl({ token, matterId: m._id });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'application/pdf' }, body: file });
      if (!res.ok) throw new Error('upload failed');
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      await add({ token, matterId: m._id, storageId, kind });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function send() {
    setError(null);
    setBusy('send');
    try {
      await submit({ token, matterId: m._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="space-y-4 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-24">
      <div>
        <h2 className="text-lg font-bold">Documents</h2>
        <p className="text-sm text-muted">Remedy highlights the clauses worth a closer look. You see them before anything goes to our lawyer.</p>
      </div>
      {m.documents.map((d) => (
        <div key={d._id} className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold capitalize">{d.kind.replace(/_/g, ' ')}</p>
            {d.submitted ? (
              <Pill tone="brand">Sent to lawyer</Pill>
            ) : (
              <button type="button" aria-label="Remove document" onClick={() => remove({ token, docId: d._id }).catch((e) => setError(errorMessage(e)))} className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
          {d.status === 'reading' ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted"><Loader2 className="size-3.5 animate-spin" /> Reading and highlighting clauses…</p>
          ) : (
            <>
              <p className="text-sm text-muted">{d.summary}</p>
              {d.clauses.map((c, i) => (
                <div key={i} className={cx('space-y-1 border-l-[3px] py-1 pl-3', RISK[c.risk].border)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-sm font-semibold">{c.title}</p>
                    <Pill tone={RISK[c.risk].tone}>{RISK[c.risk].label}</Pill>
                  </div>
                  {c.text ? <p className="text-sm italic">“{c.text}”</p> : null}
                  <p className="text-sm text-muted">{c.why}</p>
                </div>
              ))}
            </>
          )}
        </div>
      ))}
      {canAdd ? (
        <>
          <div className="flex flex-wrap gap-1.5">{KINDS.map((k) => <Chip key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Chip>)}</div>
          <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="outline" className="w-full" icon={FileUp} loading={busy === 'upload'} onClick={() => input.current?.click()}>
            {m.documents.length ? 'Add another document' : 'Attach a contract'}
          </Button>
          {pending.length ? (
            <Button variant="remedy" className="w-full" icon={Send} loading={busy === 'send'} disabled={reading} onClick={send}>
              {reading ? 'Reading your document…' : 'Send to our lawyer'}
            </Button>
          ) : null}
        </>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <p className="text-xs text-muted">PDF or photo, up to 10MB. Remedy doesn’t copy names, bank details or signatures from documents.</p>
    </aside>
  );
}
