import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BusinessNotice, EmptyCard, FlagChips, RemedyHeader, STAGES, StatusBadge, TOPIC_LABELS, sectorLabel, type MatterStatus, type Stage } from '@/components/remedy';
import { Banner, Button, Card, Chip, IconButton, Ionicons, ProgressBar, Screen, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

const TOPICS: { icon: IconName; label: string; text: string }[] = [
  { icon: 'people-outline', label: 'Hiring', text: 'Can I take on a freelancer for 3 days a week without making them an employee?' },
  { icon: 'document-text-outline', label: 'Contracts', text: 'A client wants me to sign their contract. What should I look out for?' },
  { icon: 'cash-outline', label: 'Getting paid', text: 'A client is 45 days late paying a £4,000 invoice. What can I do?' },
  { icon: 'lock-closed-outline', label: 'Data', text: 'Do I need consent to add customers to my email newsletter?' },
  { icon: 'color-palette-outline', label: 'IP', text: 'Who owns the logo a freelance designer made for us?' },
  { icon: 'storefront-outline', label: 'Premises', text: 'Our landlord wants to end our office lease. Do we have a right to stay?' },
];

export default function BusinessHome() {
  const { businessToken, setBusinessToken } = useSession();
  const token = businessToken ?? '';
  const me = useQuery(api.business.me, businessToken ? { token } : 'skip');

  useEffect(() => {
    if (businessToken && me === null) setBusinessToken(null);
  }, [businessToken, me, setBusinessToken]);

  if (!businessToken || me === null) return <Redirect href="/business/start" />;
  if (me === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  return <Home token={token} me={me} onSignOut={() => setBusinessToken(null)} />;
}

type Me = NonNullable<FunctionReturnType<typeof api.business.me>>;

function Home({ token, me, onSignOut }: { token: string; me: Me; onSignOut: () => void }) {
  const matters = useQuery(api.matters.mine, { token });
  const suggestions = useQuery(api.firms.suggestions, { token });
  const ask = useMutation(api.matters.ask);
  const deleteMyData = useMutation(api.business.deleteMyData);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const matterId = await ask({ token, question });
      setQuestion('');
      router.push(`/business/matter/${matterId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    const run = async () => {
      await deleteMyData({ token }).catch(() => {});
      onSignOut();
    };
    const msg = 'This permanently deletes your business profile, questions, documents and referrals.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete my data?\n\n${msg}`)) run();
    } else {
      Alert.alert('Delete my data?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
    }
  }

  const trigger = suggestions?.trigger;
  const activeReferral = suggestions?.referrals.find((r) => r.status !== 'declined');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={
          <RemedyHeader
            title={me.name}
            subtitle={`${sectorLabel(me.sector)} · ${me.headcount} staff · ${me.plan === 'pro' ? 'Pro' : 'Starter'}`}
            right={<IconButton name="log-out-outline" label="Sign out" onPress={onSignOut} />}
          />
        }>
        <View style={{ gap: S.xl }}>
          {trigger && !activeReferral ? (
            <Card onPress={() => router.push('/business/firms')} style={styles.firmCard}>
              <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
                <Ionicons name="business" size={26} color="#fff" />
                <View style={{ flex: 1 }}>
                  <T kind="label" style={{ color: '#fff' }}>Time to bring in a law firm?</T>
                  <T kind="small" style={{ color: '#DCE2EE' }} numberOfLines={3}>{trigger.reason}</T>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </Card>
          ) : null}
          {activeReferral ? (
            <Card onPress={() => router.push('/business/firms')} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <Ionicons name={activeReferral.status === 'accepted' ? 'checkmark-circle' : 'paper-plane-outline'} size={24} color={C.primary} />
              <View style={{ flex: 1 }}>
                <T kind="label">{activeReferral.firm}</T>
                <T kind="small" muted>
                  {activeReferral.status === 'accepted' ? `Accepted · your contact is ${activeReferral.firmContact}` : 'Handoff pack sent · waiting for the firm'}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Card>
          ) : null}

          <View style={{ gap: S.md }}>
            <T kind="title">What’s the issue?</T>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Describe it in plain English, like you would to a friend who’s a lawyer."
              placeholderTextColor={C.faint}
              multiline
              style={styles.textarea}
            />
            <Button title="Ask Remedy" icon="arrow-forward" onPress={submit} loading={busy} disabled={question.trim().length < 8} />
            <View style={styles.topics}>
              {TOPICS.map((t) => (
                <Pressable key={t.label} onPress={() => setQuestion(t.text)} style={({ pressed }) => [styles.topic, pressed && { backgroundColor: C.primarySoft }]}>
                  <Ionicons name={t.icon} size={16} color={C.primary} />
                  <T kind="small" style={{ fontWeight: '600' }}>{t.label}</T>
                </Pressable>
              ))}
            </View>
            {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          </View>

          <View style={{ gap: S.md }}>
            <T kind="heading">Your matters</T>
            {matters === undefined ? (
              <ActivityIndicator color={C.primary} />
            ) : matters.length === 0 ? (
              <EmptyCard icon="chatbubbles-outline" title="No questions yet" text="Ask anything about hiring, contracts, getting paid, data, IP or premises." />
            ) : (
              matters.map((m) => (
                <Card key={m._id} onPress={() => router.push(`/business/matter/${m._id}`)} style={{ gap: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
                    <StatusBadge status={m.status as MatterStatus} />
                    <T kind="small" muted>{TOPIC_LABELS[m.topic] ?? m.topic} · {m.ref}</T>
                    <T kind="small" muted style={{ marginLeft: 'auto' }}>{shortDate(m.createdAt)}</T>
                  </View>
                  <T kind="label" numberOfLines={2}>{m.question}</T>
                  <FlagChips codes={m.flagCodes} />
                </Card>
              ))
            )}
          </View>

          <Profile token={token} me={me} />

          <View style={styles.links}>
            <Pressable onPress={confirmDelete} hitSlop={6}>
              <T kind="small" style={[styles.link, { color: C.danger }]}>Delete my data</T>
            </Pressable>
            <Pressable onPress={() => router.push('/lawyer')} hitSlop={6}>
              <T kind="small" style={[styles.link, { color: C.muted }]}>Remedy lawyer sign in</T>
            </Pressable>
            <Pressable onPress={() => router.push('/firm')} hitSlop={6}>
              <T kind="small" style={[styles.link, { color: C.muted }]}>Partner firm sign in</T>
            </Pressable>
          </View>
          <BusinessNotice />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Profile card. Switching stage to "raising" updates the traction score live. */
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
    <Card>
      <T kind="heading">Your business</T>
      <View style={{ gap: S.sm }}>
        <T kind="small" muted>Stage</T>
        <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
          {STAGES.map((s) => <Chip key={s.id} label={s.label} selected={me.stage === s.id} onPress={() => save({ stage: s.id })} />)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <T kind="small" muted style={{ flex: 1 }}>Team size</T>
        <IconButton name="remove-circle-outline" label="Fewer staff" onPress={() => me.headcount > 1 && save({ headcount: me.headcount - 1 })} />
        <T kind="label">{me.headcount}</T>
        <IconButton name="add-circle-outline" label="More staff" onPress={() => save({ headcount: me.headcount + 1 })} />
      </View>
      <View style={{ gap: S.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T kind="small" muted>Growth score</T>
          <T kind="small" style={{ fontWeight: '700' }}>{score} / 100</T>
        </View>
        <ProgressBar value={score / 100} />
        <T kind="small" muted>
          {score >= threshold
            ? 'You’re growing fast. Remedy will suggest a partner law firm for the bigger work.'
            : `At ${threshold}, Remedy suggests a partner law firm. Raising investment or uploading a term sheet counts.`}
        </T>
        {me.traction?.signals.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {me.traction.signals.map((s) => (
              <View key={s.signal} style={styles.signal}>
                <T kind="small" style={{ color: C.primary, fontWeight: '600' }}>+{s.points} {s.signal}</T>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  textarea: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.lg,
    minHeight: 120,
    fontSize: 17,
    lineHeight: 24,
    color: C.text,
    textAlignVertical: 'top',
  },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  firmCard: { backgroundColor: C.remedy, borderColor: C.remedy },
  signal: { backgroundColor: C.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: S.lg },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
});
