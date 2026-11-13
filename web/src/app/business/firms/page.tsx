'use client';

import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Banknote, Building2, CheckCircle2, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Container } from '@/components/page';
import { BusinessNotice, sectorLabel } from '@/components/remedy';
import { Banner, Button, Card, Check, Empty, Pill, Spinner } from '@/components/ui';
import { cx, dateTime, errorMessage, money } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const TRIGGER_TITLE = {
  traction: 'Your business is growing',
  lawyer: 'Our lawyer recommends a firm',
  reserved_activity: 'This needs an authorised law firm',
} as const;

export default function FirmsPage() {
  const token = useToken('business');
  const s = useQuery(api.firms.suggestions, token ? { token } : 'skip');
  const create = useMutation(api.firms.createReferral);
  const router = useRouter();
  const [firmId, setFirmId] = useState<Id<'partnerFirms'> | null>(null);
  const [profile, setProfile] = useState(true);
  const [shareMatters, setShareMatters] = useState(true);
  const [shareDocs, setShareDocs] = useState(true);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (token === null) router.replace('/business/');
  }, [token, router]);

  if (!token || s === undefined) return <Spinner />;

  // Flagged or checked matters and all documents are ticked by default.
  const matterOn = (m: { _id: string; status: string }) => picked[m._id] ?? m.status !== 'answered';
  const docOn = (d: { _id: string }) => picked[d._id] ?? true;
  const flip = (id: string, on: boolean) => setPicked({ ...picked, [id]: !on });
  const fee = s.fees[s.feeType as 'submission' | 'seed_ready'];
  const alreadySent = new Set(s.referrals.filter((r) => r.status !== 'declined').map((r) => r.firm));

  async function send() {
    if (!firmId) return;
    const withDocs = shareDocs && s!.documents.length > 0;
    setError(null);
    setBusy(true);
    try {
      await create({
        token: token!,
        firmId,
        matterIds: shareMatters ? s!.matters.filter(matterOn).map((m) => m._id) : [],
        documentIds: withDocs ? s!.documents.filter(docOn).map((d) => d._id) : [],
        consent: { profile, matters: shareMatters, documents: withDocs },
      });
      setSent(true);
      setFirmId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container>
      <Link href="/business/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Dashboard</Link>
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Partner law firms</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {sent ? <Banner tone="success" title="Handoff pack sent">The firm can see only what you ticked. You’ll see here when they accept.</Banner> : null}
          {!s.trigger ? (
            <Empty
              icon={Building2}
              title="No firm suggested yet"
              text="Remedy suggests a partner firm when your business grows (for example raising investment), when our lawyer recommends it, or when a matter needs work only a law firm can do."
            />
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">{TRIGGER_TITLE[s.trigger.trigger]}</h2>
                <p className="text-muted">{s.trigger.reason}</p>
              </div>
              <Banner tone="info" icon={Banknote} title="How Remedy is paid">
                Remedy receives a referral fee ({money(fee)}) from the firm you choose. You always pick the firm, and you don’t pay Remedy for the introduction.
              </Banner>
              <div className="grid gap-3 md:grid-cols-2">
                {s.firms.map((f) => {
                  const on = firmId === f._id;
                  const done = alreadySent.has(f.name);
                  return (
                    <button
                      key={f._id}
                      type="button"
                      disabled={done}
                      onClick={() => setFirmId(on ? null : f._id)}
                      className={cx('space-y-2 rounded-2xl border-[1.5px] bg-surface p-5 text-left transition', on ? 'border-brand bg-[#f2f9f5]' : 'border-line hover:border-faint', done && 'opacity-50')}>
                      <div className="flex items-center gap-2">
                        <Building2 className="size-5 text-remedy" />
                        <span className="flex-1 font-semibold">{f.name}</span>
                        {on ? <CheckCircle2 className="size-5 text-brand" /> : null}
                      </div>
                      {f.licence === 'anchor' ? <Pill tone="remedy">Anchor firm</Pill> : null}
                      <p className="text-sm text-muted">{f.city} · {f.sectors.includes('any') ? 'All sectors' : f.sectors.map(sectorLabel).join(', ')}</p>
                      <p className="text-sm">{f.blurb}</p>
                      <p className="text-sm font-semibold text-warn">Remedy receives a referral fee of {money(fee)} if you choose this firm.</p>
                      {done ? <p className="text-sm text-muted">Already sent</p> : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {firmId ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-bold">What to share</h2>
              <p className="text-sm text-muted">Only ticked items go in the pack. Your lawyer’s private notes are never shared.</p>
              <Check label="Business profile" hint="Name, company number, sector, team size and stage" checked={profile} onChange={setProfile} />
              <Check label="Matters" hint="Your questions, the answers and any notes our lawyer marked shareable" checked={shareMatters} onChange={setShareMatters} />
              {shareMatters ? (
                <div className="pl-8">
                  {s.matters.map((m) => <Check key={m._id} label={m.question} hint={m.ref} checked={matterOn(m)} onChange={() => flip(m._id, matterOn(m))} />)}
                </div>
              ) : null}
              {s.documents.length ? (
                <>
                  <Check label="Documents" hint="The files you uploaded and the highlighted clauses" checked={shareDocs} onChange={setShareDocs} />
                  {shareDocs ? (
                    <div className="pl-8">
                      {s.documents.map((d) => <Check key={d._id} label={d.label} hint={d.summary ?? undefined} checked={docOn(d)} onChange={() => flip(d._id, docOn(d))} />)}
                    </div>
                  ) : null}
                </>
              ) : null}
              {error ? <Banner tone="danger">{error}</Banner> : null}
              <Button variant="remedy" className="w-full" icon={Send} loading={busy} disabled={!profile && !shareMatters && !shareDocs} onClick={send}>Send handoff pack</Button>
            </Card>
          ) : null}

          {s.referrals.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-bold">Your referrals</h2>
              {s.referrals.map((r) => (
                <Card key={r._id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-semibold">{r.firm}</p>
                    <Pill tone={r.status === 'accepted' ? 'brand' : r.status === 'declined' ? 'danger' : 'info'}>
                      {r.status === 'accepted' ? 'Accepted' : r.status === 'declined' ? 'Declined' : 'Sent'}
                    </Pill>
                  </div>
                  <p className="text-sm text-muted">Sent {dateTime(r.createdAt)} · {r.matters} matter(s), {r.documents} document(s)</p>
                  {r.status === 'accepted' ? <p className="text-sm">Your contact: <b>{r.firmContact}</b>. They’ll be in touch.</p> : null}
                  {r.status === 'declined' ? <p className="text-sm">The firm declined: {r.declineReason}</p> : null}
                </Card>
              ))}
            </section>
          ) : null}
          <BusinessNotice />
        </aside>
      </div>
    </Container>
  );
}
