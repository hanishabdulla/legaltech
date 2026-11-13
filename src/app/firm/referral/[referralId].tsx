import { useMutation, useQuery } from 'convex/react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Bullets, FLAG_LABELS, Field, Pill, REFERRAL_STATUS, RemedyHeader, Section, TRIGGER_LABEL, dateTime, openUrl, sectorLabel } from '@/components/remedy';
import { Banner, Button, Card, Divider, Ionicons, Screen, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { errorMessage, money } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export default function ReferralDetail() {
  const { referralId } = useLocalSearchParams<{ referralId: Id<'firmReferrals'> }>();
  const { firmToken } = useSession();
  const token = firmToken ?? '';
  const r = useQuery(api.firms.getReferral, firmToken ? { token, referralId } : 'skip');
  const respond = useMutation(api.firms.respond);
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null);
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!firmToken) return <Redirect href="/firm" />;
  if (r === undefined) {
    return (
      <Screen scroll={false} header={<RemedyHeader title="Handoff pack" back="/firm" />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }

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
    <Screen
      header={<RemedyHeader title={r.profile?.name ?? 'Remedy client'} subtitle={`Handoff pack · ${dateTime(r.createdAt)}`} back="/firm" />}
      footer={
        r.status === 'sent' ? (
          mode ? (
            <View style={{ gap: S.sm }}>
              {mode === 'accept' ? (
                <Field label="Contact name for the client" value={contact} onChangeText={setContact} placeholder="e.g. Sam Patel, Associate" />
              ) : (
                <Field label="Reason for declining" value={reason} onChangeText={setReason} placeholder="e.g. Conflict of interest" />
              )}
              {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
              <View style={{ flexDirection: 'row', gap: S.md }}>
                <Button title="Cancel" variant="ghost" onPress={() => setMode(null)} style={{ flex: 1 }} />
                <Button title={mode === 'accept' ? 'Accept' : 'Decline'} variant={mode === 'accept' ? 'primary' : 'danger'} onPress={submit} loading={busy} disabled={mode === 'accept' ? !contact.trim() : !reason.trim()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: S.md }}>
              <Button title="Decline" variant="danger" onPress={() => setMode('decline')} style={{ flex: 1 }} />
              <Button title="Accept" icon="checkmark" onPress={() => setMode('accept')} style={{ flex: 1 }} />
            </View>
          )
        ) : undefined
      }>
      <View style={{ gap: S.xl }}>
        <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
          <Pill text={st.text} fg={st.fg} bg={st.bg} />
          <Pill text={TRIGGER_LABEL[r.trigger]} fg={C.remedy} bg="#E7E9EF" />
          <Pill text={`${r.feeType === 'seed_ready' ? 'Seed-ready' : 'Submission'} fee ${money(r.feePence)} (recorded, not charged)`} fg={C.warn} bg={C.warnSoft} />
        </View>
        {r.status === 'accepted' ? <Banner tone="success" icon="checkmark-circle">Accepted {r.respondedAt ? dateTime(r.respondedAt) : ''}. Client contact: {r.firmContact}.</Banner> : null}
        {r.status === 'declined' ? <Banner tone="warn" icon="close-circle">Declined: {r.declineReason}</Banner> : null}

        <Card>
          <Section title="Why Remedy referred this">
            <T>{r.reason}</T>
          </Section>
          <Divider />
          <Section title="Client consented to share">
            <Bullets items={[r.consent.profile ? 'Business profile' : '', r.consent.matters ? 'Matters' : '', r.consent.documents ? 'Documents' : ''].filter(Boolean)} />
            <T kind="small" muted>Consent given {dateTime(r.consent.at)}</T>
          </Section>
        </Card>

        {r.profile ? (
          <Card>
            <T kind="heading">Business profile</T>
            <Bullets
              items={[
                r.profile.name,
                r.profile.companyNumber ? `Company number ${r.profile.companyNumber}` : 'No company number given',
                `${sectorLabel(r.profile.sector)} · ${r.profile.headcount} staff · ${r.profile.stage}`,
                r.profile.region,
              ]}
            />
          </Card>
        ) : (
          <Banner tone="info" icon="eye-off-outline">The client did not share their business profile.</Banner>
        )}

        {r.matters.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Matters</T>
            {r.matters.map((m) => (
              <Card key={m._id}>
                <T kind="small" muted>{m.ref} · {m.topic}</T>
                <T kind="label">“{m.question}”</T>
                {m.flags.length ? <Bullets items={m.flags.map((f) => `${FLAG_LABELS[f.code] ?? f.code}: ${f.reason}`)} /> : null}
                {m.answer ? (
                  <Section title={m.answerChecked ? 'Lawyer-checked answer' : 'AI draft (not lawyer-checked)'}>
                    <T kind="small">{m.answer}</T>
                  </Section>
                ) : null}
                {m.notes.length ? (
                  <Section title="Notes from the Remedy lawyer">
                    {m.notes.map((n, i) => <T key={i} kind="small">• {n.text}</T>)}
                  </Section>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {r.documents.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Documents</T>
            {r.documents.map((d) => (
              <Card key={d._id}>
                <Pressable onPress={() => d.url && openUrl(d.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <Ionicons name="document-attach-outline" size={20} color={C.primary} />
                  <T kind="label" style={{ flex: 1 }}>{d.label}</T>
                  {d.url ? <T kind="small" style={{ color: C.info }}>open ↗</T> : null}
                </Pressable>
                {d.summary ? <T kind="small" muted>{d.summary}</T> : null}
                {d.clauses.length ? <Bullets items={d.clauses.map((c) => `${c.title} (${c.risk}): ${c.why}`)} /> : null}
              </Card>
            ))}
          </View>
        ) : null}
        <T kind="small" muted center>Demo data only. Remedy lawyers’ private notes are never included in a handoff pack.</T>
      </View>
    </Screen>
  );
}
