'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft, BookOpen, Building2, Check, FileText, MessageSquare, PenLine, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Container, useIdParam } from '@/components/page';
import { FLAG_LABELS, StatusBadge, TOPIC_LABELS, citeLabel, sectorLabel, useNow } from '@/components/remedy';
import { StaffSignIn } from '@/components/staff-signin';
import { Banner, Button, Caption, Pill, Spinner, Textarea } from '@/components/ui';
import { cx, dateTime, dueLabel, errorMessage } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Matter = NonNullable<FunctionReturnType<typeof api.lawyer.getMatter>>;

export default function LawyerMatterClient() {
  const s = useStaff('lawyer');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="lawyer" />;
  return <MatterReview token={s.token} />;
}

function MatterReview({ token }: { token: string }) {
  const matterId = useIdParam<Id<'matters'>>();
  const m = useQuery(api.lawyer.getMatter, matterId ? { token, matterId } : 'skip');
  const open = useMutation(api.lawyer.open);

  useEffect(() => {
    if (matterId) open({ token, matterId }).catch(() => {});
  }, [token, matterId, open]);

  if (m === undefined) return <Spinner />;
  if (m === null) {
    return (
      <Container narrow>
        <Banner tone="warn">This matter isn’t available yet. The AI may still be drafting it.</Banner>
      </Container>
    );
  }

  return (
    <Container>
      <Link href="/lawyer/" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> Queue</Link>
      <h1 className="mb-6 font-serif text-3xl font-normal tracking-tight">{m.ref} · {m.business.name}</h1>
      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <Summary m={m} />
        <Review key={m._id} m={m} token={token} />
      </div>
    </Container>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-4">
      <Caption>{n}. {title}</Caption>
      {children}
    </section>
  );
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

/** The one-page matter summary. */
function Summary({ m }: { m: Matter }) {
  const now = useNow();
  const due = dueLabel(m.dueAt, now);
  const b = m.business;
  return (
    <article className="space-y-4 rounded-xl border border-line bg-surface p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption className="text-remedy">Remedy matter summary</Caption>
          <span className="font-mono font-medium">{m.ref}</span>
        </div>
        <p className="font-medium">{b.name} · {sectorLabel(b.sector)} · {b.headcount} staff · <span className="capitalize">{b.stage}</span> · {b.plan === 'pro' ? 'Pro' : 'Starter'}</p>
        <p className="text-sm text-muted">
          Received {dateTime(m.createdAt)}{m.dueAt ? ` · Due ${dateTime(m.dueAt)}` : ''} · Topic: {TOPIC_LABELS[m.topic] ?? m.topic}
          {b.companyNumber ? ` · Co. no. ${b.companyNumber}` : ''} · Growth score {b.traction}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusBadge status={m.status} checkedBy={m.checkedBy} />
          {m.urgency === 'high' ? <Pill tone="danger">High urgency</Pill> : null}
          {due && m.status === 'in_review' ? <span className={cx('text-xs', due.overdue ? 'text-danger' : 'text-muted')}>{due.text}</span> : null}
          {m.assignedTo ? <span className="text-xs text-muted">· {m.assignedTo}</span> : null}
        </div>
      </div>

      <Section n={1} title="The question (client’s words)"><p>“{m.question}”</p></Section>

      <Section n={2} title="Facts we have">
        {m.summary?.facts.length ? (
          <ul className="space-y-1.5">
            {m.summary.facts.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Pill tone={f.source === 'document' ? 'info' : 'brand'}>{f.source}</Pill>
                <span>{f.fact}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{m.summary ? 'None stated beyond the question.' : 'Summary being written…'}</p>
        )}
      </Section>

      <Section n={3} title="What we don’t know"><Bullets items={m.summary?.unknowns ?? []} empty="Nothing flagged as missing." /></Section>

      <Section n={4} title="AI draft answer + legislation relied on">
        {m.draft ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">Confidence {Math.round(m.draft.confidence * 100)}% · {m.draft.model}</p>
            <p className="text-sm whitespace-pre-wrap">{m.draft.answer}</p>
            {m.draft.citations.map((c) => (
              <a key={c.url} href={c.url} target="_blank" rel="noopener" className="block space-y-1 rounded-xl bg-info-soft p-3 text-sm hover:ring-1 hover:ring-info">
                <p className="inline-flex items-center gap-1.5 font-medium text-info"><BookOpen className="size-4" /> {citeLabel(c)} · {c.heading}</p>
                <p className="line-clamp-4 text-muted">{c.excerpt}</p>
                <p className="text-xs text-muted">{c.source === 'fixture' ? 'Demo fixture summary, not official text' : `Version ${c.versionDate}`}</p>
              </a>
            ))}
            {!m.draft.citations.length ? <Banner tone="warn">No verified citations. Check every legal statement.</Banner> : null}
          </div>
        ) : (
          <Banner tone="warn">The AI couldn’t produce a reliable draft. Please write the answer.</Banner>
        )}
      </Section>

      <Section n={5} title="Flags and questions for the lawyer">
        <div className="space-y-3">
          {m.flags.map((f) => (
            <div key={f.code} className="text-sm">
              <p className="font-medium text-warn">⚑ {FLAG_LABELS[f.code] ?? f.code}</p>
              <p>{f.reason}</p>
              <p className="text-muted">→ {f.questionForLawyer}</p>
            </div>
          ))}
          {m.summary?.questionsForLawyer.length ? <Bullets items={m.summary.questionsForLawyer} empty="" /> : null}
        </div>
      </Section>

      <Section n={6} title="Documents (clauses highlighted)">
        {m.documents.length ? (
          m.documents.map((d) => (
            <div key={d._id} className="space-y-1 text-sm">
              <a href={d.url ?? undefined} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium capitalize hover:underline">
                <FileText className="size-4 text-brand" /> {d.kind.replace(/_/g, ' ')}{d.submitted ? '' : ' (not yet sent by client)'}
              </a>
              <p className="text-muted">{d.summary}</p>
              <ul className="space-y-0.5">
                {d.clauses.map((c, i) => (
                  <li key={i}>• <b className={c.risk === 'high' ? 'text-danger' : c.risk === 'medium' ? 'text-warn' : ''}>{c.title}</b>: {c.why}</li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">No documents.</p>
        )}
      </Section>

      <Section n={7} title="Suggested reply options"><Bullets items={m.summary?.replyOptions ?? []} empty="No options suggested." /></Section>
    </article>
  );
}

function Review({ m, token }: { m: Matter; token: string }) {
  const review = useMutation(api.lawyer.review);
  const [answer, setAnswer] = useState(m.finalAnswer ?? m.draft?.answer ?? '');
  const [message, setMessage] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [shareableNote, setShareableNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const edited = answer.trim() !== (m.draft?.answer ?? '').trim();
  const actionable = m.status === 'in_review' || m.status === 'awaiting_client';

  async function act(action: 'approve' | 'edit_approve' | 'request_info' | 'recommend_firm') {
    setError(null);
    setDone(null);
    setBusy(action);
    try {
      await review({
        token,
        matterId: m._id,
        action,
        finalAnswer: action === 'request_info' ? undefined : answer,
        messageToClient: message || undefined,
        privateNote: privateNote || undefined,
        shareableNote: shareableNote || undefined,
      });
      setMessage('');
      setPrivateNote('');
      setShareableNote('');
      setDone(
        {
          approve: 'Approved and sent to the client.',
          edit_approve: 'Edited answer approved and sent.',
          request_info: 'Request sent. The matter waits for the client.',
          recommend_firm: 'Firm recommended. The client will see partner firms.',
        }[action],
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <h2 className="text-sm font-medium text-ink">Answer to the client</h2>
          <p className="text-sm text-muted">{edited ? 'Edited from the AI draft. Both versions are kept.' : 'AI draft. Edit anything before approving.'}</p>
        </div>
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-64 text-sm" placeholder="Write the answer…" />
        {m.summary?.replyOptions.length || (edited && m.draft) ? (
          <div className="flex flex-wrap gap-2">
            {m.summary?.replyOptions.map((o, i) => (
              <Button key={i} size="sm" variant="ghost" onClick={() => setAnswer(o.replace(/^[AB][:.)]\s*/, ''))}>Use option {String.fromCharCode(65 + i)}</Button>
            ))}
            {edited && m.draft ? <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setAnswer(m.draft!.answer)}>Reset to AI draft</Button> : null}
          </div>
        ) : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Message to the client (for “Request info”)</span>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-20 text-sm" placeholder="e.g. Who decides their hours? Can they send someone else?" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Shareable note (goes to a partner firm if the client consents)</span>
          <Textarea value={shareableNote} onChange={(e) => setShareableNote(e.target.value)} className="min-h-16 text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Private note (Remedy only, never shared)</span>
          <Textarea value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} className="min-h-16 text-sm" />
        </label>
        {!actionable ? <Banner tone="success">{m.status === 'lawyer_checked' ? `Checked by ${m.checkedBy}. You can still update it.` : 'Firm recommended.'}</Banner> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {edited ? (
            <Button variant="remedy" icon={PenLine} loading={busy === 'edit_approve'} disabled={!!busy || !answer.trim()} onClick={() => act('edit_approve')}>Edit and approve</Button>
          ) : (
            <Button variant="remedy" icon={Check} loading={busy === 'approve'} disabled={!!busy || !answer.trim()} onClick={() => act('approve')}>Approve</Button>
          )}
          <Button variant="outline" icon={MessageSquare} loading={busy === 'request_info'} disabled={!!busy || !message.trim()} onClick={() => act('request_info')}>Request info</Button>
          <Button variant="outline" icon={Building2} loading={busy === 'recommend_firm'} disabled={!!busy} onClick={() => act('recommend_firm')}>Recommend firm</Button>
        </div>
        {done ? <Banner tone="success">{done}</Banner> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
      </section>

      {m.messages.length ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-medium">Messages</h2>
          {m.messages.map((x) => (
            <div key={x._id} className="text-sm">
              <p className="text-muted">{x.from === 'client' ? 'Client' : x.name ?? 'Lawyer'} · {dateTime(x.at)}</p>
              <p>{x.text}</p>
            </div>
          ))}
        </section>
      ) : null}

      {m.reviews.some((r) => r.privateNote || r.shareableNote) ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-medium">Notes</h2>
          {m.reviews.filter((r) => r.privateNote || r.shareableNote).map((r) => (
            <div key={r._id} className="space-y-0.5 text-sm">
              <p className="text-muted">{r.by} · {r.action.replace('_', ' ')} · {dateTime(r.at)}</p>
              {r.shareableNote ? <p><b>Shareable:</b> {r.shareableNote}</p> : null}
              {r.privateNote ? <p><b>Private:</b> {r.privateNote}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Audit trail</h2>
        <ul className="space-y-1 text-sm">
          {m.log.map((l) => (
            <li key={l._id} className="flex gap-3">
              <span className="w-36 shrink-0 text-muted">{dateTime(l.at)}</span>
              <span className={cx('flex-1')}>{l.event.replace(/_/g, ' ')}</span>
              <span className="truncate text-muted">{l.actor.replace(/^staff:.*/, 'staff')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
