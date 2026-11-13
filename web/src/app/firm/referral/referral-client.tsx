'use client';

import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Check, EyeOff, FileText, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Container, useIdParam } from '@/components/page';
import { FLAG_LABELS, REFERRAL_STATUS, TRIGGER_LABEL, sectorLabel } from '@/components/remedy';
import { StaffSignIn } from '@/components/staff-signin';
import { Banner, Button, Caption, Card, Field, Input, Pill, Spinner } from '@/components/ui';
import { dateTime, errorMessage, money } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export default function ReferralClient() {
  const s = useStaff('firm');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="firm" />;
  return <Pack token={s.token} />;
}

function Pack({ token }: { token: string }) {
  const referralId = useIdParam<Id<'firmReferrals'>>();
  const r = useQuery(api.firms.getReferral, referralId ? { token, referralId } : 'skip');
  const respond = useMutation(api.firms.respond);
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null);
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (r === undefined) return <Spinner />;

  async function submit() {
    if (!mode) return;
    setError(null);
    setBusy(true);
    try {
      await respond({ token, referralId, decision: mode, contact: contact || undefined, reason: reason || undefined });
      setMode(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const st = REFERRAL_STATUS[r.status];

  return (
    <Container>
      <Link href="/firm/" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> Inbox</Link>
      <div className="mb-6 space-y-3">
        <h1 className="font-serif text-3xl font-normal tracking-tight">{r.profile?.name ?? 'Remedy client'}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Pill tone={st.tone}>{st.text}</Pill>
          <span>{TRIGGER_LABEL[r.trigger]}</span>
          <span>{r.feeType === 'seed_ready' ? 'Seed-ready' : 'Submission'} fee {money(r.feePence)}, not charged</span>
          <span>{dateTime(r.createdAt)}</span>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {r.matters.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-ink">Matters</h2>
              {r.matters.map((m) => (
                <Card key={m._id} className="space-y-3">
                  <p className="text-sm text-muted">{m.ref} · {m.topic}</p>
                  <p className="font-medium">“{m.question}”</p>
                  {m.flags.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm">{m.flags.map((f) => <li key={f.code}><b>{FLAG_LABELS[f.code] ?? f.code}:</b> {f.reason}</li>)}</ul>
                  ) : null}
                  {m.answer ? (
                    <div className="space-y-1">
                      <Caption>{m.answerChecked ? 'Lawyer-checked answer' : 'AI draft (not lawyer-checked)'}</Caption>
                      <p className="text-sm whitespace-pre-wrap">{m.answer}</p>
                    </div>
                  ) : null}
                  {m.notes.length ? (
                    <div className="space-y-1">
                      <Caption>Notes from the Remedy lawyer</Caption>
                      {m.notes.map((n, i) => <p key={i} className="text-sm">• {n.text}</p>)}
                    </div>
                  ) : null}
                </Card>
              ))}
            </section>
          ) : null}
          {r.documents.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-ink">Documents</h2>
              {r.documents.map((d) => (
                <Card key={d._id} className="space-y-2">
                  <a href={d.url ?? undefined} target="_blank" rel="noopener" className="inline-flex items-center gap-2 font-medium hover:underline"><FileText className="size-4 text-brand" /> {d.label}</a>
                  {d.summary ? <p className="text-sm text-muted">{d.summary}</p> : null}
                  {d.clauses.length ? <ul className="list-disc space-y-0.5 pl-5 text-sm">{d.clauses.map((c, i) => <li key={i}><b>{c.title}</b> ({c.risk}): {c.why}</li>)}</ul> : null}
                </Card>
              ))}
            </section>
          ) : null}
          <p className="text-sm text-muted">Demo data only. Remedy lawyers’ private notes are never included in a handoff pack.</p>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {r.status === 'sent' ? (
            <Card className="space-y-3">
              <h2 className="font-medium">Respond</h2>
              {mode === 'accept' ? (
                <Field label="Contact name for the client"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Sam Patel, Associate" /></Field>
              ) : mode === 'decline' ? (
                <Field label="Reason for declining"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Conflict of interest" /></Field>
              ) : null}
              {error ? <Banner tone="danger">{error}</Banner> : null}
              {mode ? (
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setMode(null)}>Cancel</Button>
                  <Button className="flex-1" variant={mode === 'accept' ? 'primary' : 'danger'} loading={busy} disabled={mode === 'accept' ? !contact.trim() : !reason.trim()} onClick={submit}>
                    {mode === 'accept' ? 'Accept' : 'Decline'}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="danger" icon={X} className="flex-1 border border-danger" onClick={() => setMode('decline')}>Decline</Button>
                  <Button icon={Check} className="flex-1" onClick={() => setMode('accept')}>Accept</Button>
                </div>
              )}
            </Card>
          ) : null}
          {r.status === 'accepted' ? <Banner tone="success">Accepted {r.respondedAt ? dateTime(r.respondedAt) : ''}. Client contact: {r.firmContact}.</Banner> : null}
          {r.status === 'declined' ? <Banner tone="warn">Declined: {r.declineReason}</Banner> : null}

          <Card className="space-y-4">
            <div className="space-y-1">
              <Caption>Why Remedy referred this</Caption>
              <p>{r.reason}</p>
            </div>
            <div className="space-y-1">
              <Caption>Client consented to share</Caption>
              <ul className="list-disc pl-5 text-sm">
                {r.consent.profile ? <li>Business profile</li> : null}
                {r.consent.matters ? <li>Matters</li> : null}
                {r.consent.documents ? <li>Documents</li> : null}
              </ul>
              <p className="text-xs text-muted">Consent given {dateTime(r.consent.at)}</p>
            </div>
          </Card>

          {r.profile ? (
            <Card className="space-y-1">
              <h2 className="font-medium">Business profile</h2>
              <p>{r.profile.name}</p>
              <p className="text-sm text-muted">{r.profile.companyNumber ? `Company number ${r.profile.companyNumber}` : 'No company number given'}</p>
              <p className="text-sm text-muted">{sectorLabel(r.profile.sector)} · {r.profile.headcount} staff · {r.profile.stage}</p>
              <p className="text-sm text-muted">{r.profile.region}</p>
            </Card>
          ) : (
            <Banner tone="info" icon={EyeOff}>The client did not share their business profile.</Banner>
          )}
        </aside>
      </div>
    </Container>
  );
}
