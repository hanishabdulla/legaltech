'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft, Check, CheckCheck, FileText, Flag, Heart, MessageSquare, Save, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { OutcomePill, SchemeCard, type Outcome } from '@/components/cc';
import { Container, useIdParam } from '@/components/page';
import { StaffSignIn } from '@/components/staff-signin';
import { Banner, Button, Caption, Card, Pill, Spinner, Textarea } from '@/components/ui';
import { cx, errorMessage, longDate, shortDate, time } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type CaseDetail = NonNullable<FunctionReturnType<typeof api.adviser.getCase>>;
const SOURCE: Record<string, string> = { client: 'Client said', document: 'From document', adviser: 'Adviser' };

export default function AdviserCaseClient() {
  const s = useStaff('staff');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="adviser" />;
  return <Review token={s.token} />;
}

function Review({ token }: { token: string }) {
  const caseId = useIdParam<Id<'cases'>>();
  const c = useQuery(api.adviser.getCase, caseId ? { token, caseId } : 'skip');
  const open = useMutation(api.adviser.open);

  useEffect(() => {
    if (c?.status === 'submitted') open({ token, caseId }).catch(() => {});
  }, [c?.status, open, token, caseId]);

  if (c === undefined) return <Spinner />;
  if (c === null) {
    return (
      <Container narrow>
        <Banner tone="warn" title="Case not available">It may not have been sent to an adviser yet.</Banner>
      </Container>
    );
  }

  return (
    <Container>
      <Link href="/adviser/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Queue</Link>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Case review</h1>
          <p className="text-muted">Sent {shortDate(c.submittedAt ?? c.createdAt)} · <span className="capitalize">{c.status.replace('_', ' ')}</span></p>
        </div>
      </div>
      <div className="mb-6 space-y-3">
        {c.safeguardingFlag ? <Banner tone="danger" icon={Heart} title="Safeguarding">{c.safeguardingFlag}</Banner> : null}
        {c.urgency === 'urgent' ? <Banner tone="danger" icon={Zap} title="Urgent">Little or no food or fuel, or a risk flag. Prioritise this case.</Banner> : null}
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Evidence c={c} />
        <Decisions c={c} token={token} />
      </div>
    </Container>
  );
}

function Evidence({ c }: { c: CaseDetail }) {
  return (
    <div className="space-y-6">
      {c.adviserSummary ? (
        <Card className="space-y-1">
          <Caption>AI summary</Caption>
          {c.adviserSummary.split('\n').map((l, i) => <p key={i} className={i === 0 ? 'font-semibold' : ''}>{l}</p>)}
        </Card>
      ) : null}
      {c.adviserFlags.map((f) => <Banner key={f} tone="warn" icon={Flag}>{f}</Banner>)}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Facts</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {c.chips.map((f, i) => (
            <div key={`${f.key}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">{f.label}</span>
              <Pill tone={f.source === 'document' ? 'info' : 'muted'}>{SOURCE[f.source] ?? f.source}</Pill>
            </div>
          ))}
        </div>
      </section>

      {c.documents.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Documents</h2>
          {c.documents.map((d) => (
            <a key={d._id} href={d.url ?? undefined} target="_blank" rel="noopener" className="flex gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-faint">
              {d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.url} alt="" className="size-14 shrink-0 rounded-lg bg-bg object-cover" />
              ) : null}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold capitalize">{d.kind.replace(/_/g, ' ')}</p>
                <p className="text-sm text-muted">{d.summary ?? 'Reading…'}</p>
                <p className={cx('text-sm font-bold', d.confirmedByClient ? 'text-brand' : 'text-warn')}>
                  {d.confirmedByClient ? 'Confirmed by client' : 'Not confirmed'} · {Math.round(d.confidence * 100)}% AI confidence
                </p>
              </div>
            </a>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Pre-check (rules)</h2>
        {c.eligibility.map((e) => (
          <SchemeCard key={e._id} name={e.info?.name ?? e.scheme} who={e.rulesetVersion} outcome={e.outcome as Outcome} toFinish={e.toFinish} trace={e.trace} flags={e.flags} />
        ))}
      </section>
    </div>
  );
}

function Decisions({ c, token }: { c: CaseDetail; token: string }) {
  const decide = useMutation(api.adviser.decideReferral);
  const editNote = useMutation(api.adviser.editNote);
  const requestInfo = useMutation(api.adviser.requestInfo);
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [payload, setPayload] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = c.referrals.filter((r) => r.status === 'pending');

  async function run(key: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Referrals</h2>
          {pending.length > 1 ? (
            <Button size="sm" icon={CheckCheck} loading={busy === 'all'} onClick={() => run('all', async () => { for (const r of pending) await decide({ token, referralId: r._id, decision: 'approve' }); })}>
              Approve all {pending.length}
            </Button>
          ) : null}
        </div>
        {c.referrals.length === 0 ? <p className="text-muted">No referrals were requested.</p> : null}
        {c.referrals.map((r) => {
          const e = c.eligibility.find((x) => x.scheme === r.scheme);
          return (
            <Card key={r._id} className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="flex-1 font-semibold">{r.info?.name ?? r.scheme}</p>
                {e ? <OutcomePill outcome={e.outcome as Outcome} /> : null}
              </div>
              {r.status === 'pending' ? (
                rejecting === r._id ? (
                  <div className="space-y-2">
                    <Textarea value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason (the client will see this)" className="min-h-20" />
                    <div className="flex gap-2">
                      <Button variant="danger" className="border border-danger" loading={busy === r._id} onClick={() => run(r._id, async () => { await decide({ token, referralId: r._id, decision: 'reject', reason }); setRejecting(null); setReason(''); })}>Confirm reject</Button>
                      <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button className="flex-1" icon={Check} loading={busy === r._id} onClick={() => run(r._id, () => decide({ token, referralId: r._id, decision: 'approve' }))}>Approve</Button>
                    <Button variant="danger" onClick={() => setRejecting(r._id)}>Reject</Button>
                  </div>
                )
              ) : (
                <div className="text-sm">
                  <p className={cx('font-bold capitalize', r.status === 'rejected' ? 'text-danger' : 'text-brand')}>
                    {r.status}{r.decidedByName ? ` by ${r.decidedByName}` : ''}{r.decidedAt ? ` · ${shortDate(r.decidedAt)}` : ''}
                  </p>
                  {r.reason ? <p className="text-muted">{r.reason}</p> : null}
                </div>
              )}
              <button type="button" onClick={() => setPayload(payload === r._id ? null : r._id)} className="text-sm font-bold text-brand">
                {payload === r._id ? 'Hide' : 'Show'} pre-filled form fields
              </button>
              {payload === r._id ? (
                <dl className="space-y-1 rounded-xl bg-bg p-3 text-sm">
                  {Object.entries(r.payload as Record<string, unknown>).map(([k, val]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="font-semibold">{k}:</dt>
                      <dd className="text-muted">{Array.isArray(val) ? val.join(', ') || '—' : val === null || val === '' ? '—' : String(val)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Card>
          );
        })}
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Case note</h2>
        <p className="text-sm text-muted">Drafted by AI. Edit before approving; edits are logged.</p>
        <Textarea value={note ?? c.caseNote ?? ''} onChange={(e) => setNote(e.target.value)} className="min-h-44 text-sm" />
        {note !== null && note !== c.caseNote ? (
          <Button variant="secondary" icon={Save} loading={busy === 'note'} onClick={() => run('note', async () => { await editNote({ token, caseId: c._id, caseNote: note }); setNote(null); })}>Save note</Button>
        ) : null}
      </section>

      {c.actions.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Action plan given to the client</h2>
          {c.actions.map((a) => (
            <div key={a._id} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <p className="font-semibold">{a.title}</p>
              {a.deadline ? <p className="font-bold text-warn">Deadline {longDate(a.deadline)}</p> : null}
              {a.handoffTo ? <p className="text-muted">Hand off: {a.handoffTo}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Ask the client for something</h2>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please add a photo of your sanction letter." className="min-h-20" />
        <Button variant="secondary" icon={MessageSquare} disabled={!message.trim()} loading={busy === 'msg'} onClick={() => run('msg', async () => { await requestInfo({ token, caseId: c._id, message }); setMessage(''); })}>Send request</Button>
        {c.adviserMessage ? <p className="text-sm text-muted">Last request: “{c.adviserMessage}”</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold"><FileText className="size-4" /> Audit trail</h2>
        <ul className="space-y-1.5 rounded-2xl border border-line bg-surface p-4 text-sm">
          {c.log.map((l) => (
            <li key={l._id} className="flex gap-3">
              <span className="w-24 shrink-0 text-muted">{time(l.at)} {shortDate(l.at)}</span>
              <span><b>{l.actor.startsWith('staff:') ? 'adviser' : l.actor}</b> {l.event.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
