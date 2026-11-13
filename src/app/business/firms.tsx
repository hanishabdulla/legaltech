import { useMutation, useQuery } from 'convex/react';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BusinessNotice, Check, EmptyCard, Pill, RemedyHeader, dateTime, sectorLabel } from '@/components/remedy';
import { Banner, Button, Card, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage, money } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const TRIGGER_TITLE = {
  traction: 'Your business is growing',
  lawyer: 'Our lawyer recommends a firm',
  reserved_activity: 'This needs an authorised law firm',
} as const;

export default function Firms() {
  const { businessToken } = useSession();
  const token = businessToken ?? '';
  const s = useQuery(api.firms.suggestions, businessToken ? { token } : 'skip');
  const create = useMutation(api.firms.createReferral);
  const [firmId, setFirmId] = useState<Id<'partnerFirms'> | null>(null);
  const [profile, setProfile] = useState(true);
  const [shareMatters, setShareMatters] = useState(true);
  const [shareDocs, setShareDocs] = useState(true);
  // Client's ticks over the defaults (flagged/checked matters and all documents are ticked by default).
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!businessToken) return <Redirect href="/business/start" />;

  const matterOn = (m: { _id: string; status: string }) => picked[m._id] ?? m.status !== 'answered';
  const docOn = (d: { _id: string }) => picked[d._id] ?? true;
  const flip = (id: string, on: boolean) => setPicked({ ...picked, [id]: !on });
  const matterIds = (s?.matters ?? []).filter(matterOn).map((m) => m._id);
  const docIds = (s?.documents ?? []).filter(docOn).map((d) => d._id);

  async function send() {
    if (!firmId) return;
    const withDocs = shareDocs && !!s?.documents.length;
    setError(null);
    setBusy(true);
    try {
      await create({
        token,
        firmId,
        matterIds: shareMatters ? matterIds : [],
        documentIds: withDocs ? docIds : [],
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

  const fee = s ? s.fees[s.feeType as 'submission' | 'seed_ready'] : 0;
  const alreadySent = new Set(s?.referrals.filter((r) => r.status !== 'declined').map((r) => r.firm));

  return (
    <Screen
      header={<RemedyHeader title="Partner law firms" back="/business" />}
      footer={s?.trigger && firmId ? <Button title="Send handoff pack" icon="paper-plane" onPress={send} loading={busy} disabled={!profile && !shareMatters && !shareDocs} /> : undefined}>
      {s === undefined ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      ) : (
        <View style={{ gap: S.xl }}>
          {s.referrals.length ? (
            <View style={{ gap: S.sm }}>
              <T kind="heading">Your referrals</T>
              {s.referrals.map((r) => (
                <Card key={r._id} style={{ gap: S.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <T kind="label" style={{ flex: 1 }}>{r.firm}</T>
                    <Pill
                      text={r.status === 'accepted' ? 'Accepted' : r.status === 'declined' ? 'Declined' : 'Sent'}
                      fg={r.status === 'accepted' ? C.primary : r.status === 'declined' ? C.danger : C.info}
                      bg={r.status === 'accepted' ? C.primarySoft : r.status === 'declined' ? C.dangerSoft : C.infoSoft}
                    />
                  </View>
                  <T kind="small" muted>Sent {dateTime(r.createdAt)} · {r.matters} matter(s), {r.documents} document(s)</T>
                  {r.status === 'accepted' ? <T kind="small">Your contact: <T kind="small" style={{ fontWeight: '700' }}>{r.firmContact}</T>. They’ll be in touch.</T> : null}
                  {r.status === 'declined' ? <T kind="small">The firm declined: {r.declineReason}</T> : null}
                </Card>
              ))}
            </View>
          ) : null}
          {sent ? <Banner tone="success" icon="checkmark-circle" title="Handoff pack sent">The firm can see only what you ticked. You’ll see here when they accept.</Banner> : null}

          {!s.trigger ? (
            <EmptyCard icon="business-outline" title="No firm suggested yet" text="Remedy suggests a partner firm when your business grows (for example raising investment), when our lawyer recommends it, or when a matter needs work only a law firm can do." />
          ) : (
            <>
              <View style={{ gap: S.sm }}>
                <T kind="title">{TRIGGER_TITLE[s.trigger.trigger]}</T>
                <T muted>{s.trigger.reason}</T>
              </View>
              <Banner tone="info" icon="cash-outline" title="How Remedy is paid">
                {`Remedy receives a referral fee (${money(fee)}) from the firm you choose. You always pick the firm, and you don’t pay Remedy for the introduction.`}
              </Banner>

              <View style={{ gap: S.md }}>
                <T kind="heading">Choose a firm</T>
                {s.firms.map((f) => {
                  const on = firmId === f._id;
                  const done = alreadySent.has(f.name);
                  return (
                    <Pressable key={f._id} disabled={done} onPress={() => setFirmId(on ? null : f._id)} style={[styles.firm, on && styles.firmOn, done && { opacity: 0.5 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                        <Ionicons name="business" size={20} color={C.remedy} />
                        <T kind="label" style={{ flex: 1 }}>{f.name}</T>
                        {f.licence === 'anchor' ? <Pill text="Anchor firm" fg={C.remedy} bg="#E7E9EF" /> : null}
                        {on ? <Ionicons name="checkmark-circle" size={22} color={C.primary} /> : null}
                      </View>
                      <T kind="small" muted>{f.city} · {f.sectors.includes('any') ? 'All sectors' : f.sectors.map(sectorLabel).join(', ')}</T>
                      <T kind="small">{f.blurb}</T>
                      <T kind="small" style={{ color: C.warn, fontWeight: '600' }}>Remedy receives a referral fee of {money(fee)} if you choose this firm.</T>
                      {done ? <T kind="small" muted>Already sent</T> : null}
                    </Pressable>
                  );
                })}
              </View>

              {firmId ? (
                <Card>
                  <T kind="heading">What to share</T>
                  <T kind="small" muted>Only ticked items go in the pack. Your lawyer’s private notes are never shared.</T>
                  <Check label="Business profile" hint="Name, company number, sector, team size and stage" checked={profile} onPress={() => setProfile(!profile)} />
                  <Check label="Matters" hint="Your questions, the answers and any notes our lawyer marked shareable" checked={shareMatters} onPress={() => setShareMatters(!shareMatters)} />
                  {shareMatters ? (
                    <View style={styles.indent}>
                      {s.matters.map((m) => (
                        <Check key={m._id} label={m.question} hint={m.ref} checked={matterOn(m)} onPress={() => flip(m._id, matterOn(m))} />
                      ))}
                    </View>
                  ) : null}
                  {s.documents.length ? (
                    <>
                      <Check label="Documents" hint="The files you uploaded and the highlighted clauses" checked={shareDocs} onPress={() => setShareDocs(!shareDocs)} />
                      {shareDocs ? (
                        <View style={styles.indent}>
                          {s.documents.map((d) => (
                            <Check key={d._id} label={d.label} hint={d.summary ?? undefined} checked={docOn(d)} onPress={() => flip(d._id, docOn(d))} />
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </Card>
              ) : null}
            </>
          )}
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          <BusinessNotice />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  firm: { gap: S.xs, padding: S.lg, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  firmOn: { borderColor: C.primary, backgroundColor: '#F2F9F5' },
  indent: { paddingLeft: S.xl, gap: 2 },
});
