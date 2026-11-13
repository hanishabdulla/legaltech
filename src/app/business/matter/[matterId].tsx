import { useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { BusinessNotice, Citations, FLAG_LABELS, Field, RemedyHeader, StatusBadge, TOPIC_LABELS, dateTime, type MatterStatus } from '@/components/remedy';
import { Banner, Button, Card, Divider, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export default function MatterScreen() {
  const { matterId } = useLocalSearchParams<{ matterId: Id<'matters'> }>();
  const { businessToken } = useSession();
  const token = businessToken ?? '';
  const m = useQuery(api.matters.get, businessToken ? { token, matterId } : 'skip');
  const reply = useMutation(api.matters.reply);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!businessToken) return <Redirect href="/business/start" />;
  if (m === undefined) {
    return (
      <Screen header={<RemedyHeader title="Your answer" back="/business" />} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }

  const status = m.status as MatterStatus;
  const checked = !!m.finalAnswer && !!m.checkedBy;
  const flagged = m.flags.length > 0;

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await reply({ token, matterId, text });
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const lawyerAsk = [...m.messages].reverse().find((x) => x.from === 'lawyer');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<RemedyHeader title={TOPIC_LABELS[m.topic] ?? 'Your question'} subtitle={`${m.ref} · ${dateTime(m.createdAt)}`} back="/business" />}>
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <StatusBadge status={status} checkedBy={m.checkedBy} />
            <T kind="title">{m.question}</T>
          </View>

          {status === 'answering' ? (
            <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <ActivityIndicator color={C.primary} />
              <T kind="label" center>Reading the legislation…</T>
              <T kind="small" muted center>Remedy is finding the relevant sections and drafting an answer. This takes a few seconds.</T>
            </Card>
          ) : null}

          {status === 'awaiting_client' && lawyerAsk ? (
            <Card style={{ borderColor: C.danger, borderWidth: 1.5 }}>
              <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
                <Ionicons name="chatbubble-ellipses" size={20} color={C.danger} />
                <T kind="label">{lawyerAsk.name ?? 'Our lawyer'} needs a bit more information</T>
              </View>
              <T>{lawyerAsk.text}</T>
              <Field label="Your reply" value={text} onChangeText={setText} multiline placeholder="Type your answer…" />
              <Button title="Send reply" icon="send" onPress={send} loading={busy} disabled={!text.trim()} />
              {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
            </Card>
          ) : null}

          {checked ? (
            <Card style={{ borderColor: C.primary, borderWidth: 1.5 }}>
              <View style={styles.checkedHead}>
                <Ionicons name="shield-checkmark" size={20} color={C.primary} />
                <T kind="label" style={{ color: C.primary, flex: 1 }}>Checked by {m.checkedBy}, Remedy lawyer</T>
                {m.checkedAt ? <T kind="small" muted>{dateTime(m.checkedAt)}</T> : null}
              </View>
              <T selectable>{m.finalAnswer}</T>
              {m.draft ? <Citations citations={m.draft.citations} /> : null}
              <T kind="small" muted>
                Given by a solicitor working outside a law firm under SRA rules. Some protections differ, for example there is no compulsory professional indemnity cover through Remedy, and this may not be covered by legal privilege.
              </T>
            </Card>
          ) : null}

          {!checked && m.draft && status !== 'answering' ? (
            <Card style={flagged ? { borderColor: C.warn, borderWidth: 1.5 } : undefined}>
              <View style={styles.checkedHead}>
                <Ionicons name="sparkles" size={18} color={C.info} />
                <T kind="label" style={{ color: C.info, flex: 1 }}>{flagged ? 'AI draft · our lawyer is checking this' : 'AI answer'}</T>
              </View>
              <T selectable>{m.draft.answer}</T>
              {m.draft.nextStep ? (
                <View style={styles.next}>
                  <T kind="caption">Next step</T>
                  <T kind="small">{m.draft.nextStep}</T>
                </View>
              ) : null}
              <Citations citations={m.draft.citations} />
              <Banner tone={flagged ? 'warn' : 'info'} icon={flagged ? 'hourglass-outline' : 'information-circle'}>
                {flagged
                  ? 'Our lawyer is checking this. Don’t rely on it until it shows “Lawyer-checked”.'
                  : 'General information about the law in England and Wales, not legal advice. Ask a follow-up if your situation is different.'}
              </Banner>
            </Card>
          ) : null}

          {!m.draft && !checked && status !== 'answering' ? (
            <Banner tone="info" icon="person-outline" title="A lawyer will answer this">
              Remedy couldn’t give a reliable answer from the legislation, so a Remedy lawyer will write one for you.
            </Banner>
          ) : null}

          {flagged && status !== 'answering' ? (
            <Card>
              <T kind="heading">What needs a lawyer, and why</T>
              {m.flags.map((f, i) => (
                <View key={f.code} style={{ gap: S.xs }}>
                  {i ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: i ? S.sm : 0 }}>
                    <Ionicons name="flag" size={15} color={C.warn} />
                    <T kind="label">{FLAG_LABELS[f.code] ?? f.code}</T>
                  </View>
                  <T kind="small" muted>{f.reason}</T>
                </View>
              ))}
            </Card>
          ) : null}

          {status === 'referral_suggested' ? (
            <Card onPress={() => router.push('/business/firms')} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: '#E7E9EF' }}>
              <Ionicons name="business" size={24} color={C.remedy} />
              <View style={{ flex: 1 }}>
                <T kind="label">Our lawyer recommends a partner firm</T>
                <T kind="small" muted>See the suggested firms and choose what to share.</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Card>
          ) : null}

          {m.messages.length ? (
            <View style={{ gap: S.sm }}>
              <T kind="heading">Messages</T>
              {m.messages.map((x) => (
                <View key={x._id} style={[styles.msg, x.from === 'client' ? styles.mine : styles.theirs]}>
                  <T kind="small" muted>{x.from === 'client' ? 'You' : `${x.name ?? 'Lawyer'} · Remedy`} · {dateTime(x.at)}</T>
                  <T kind="small">{x.text}</T>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ gap: S.sm }}>
            <T kind="heading">Documents</T>
            {m.documents.map((d) => (
              <Card key={d._id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md }}>
                <Ionicons name="document-attach-outline" size={22} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <T kind="label" style={{ textTransform: 'capitalize' }}>{d.kind.replace(/_/g, ' ')}</T>
                  <T kind="small" muted numberOfLines={2}>{d.status === 'reading' ? 'Reading…' : d.summary}</T>
                </View>
                {d.submitted ? <Ionicons name="checkmark-circle" size={18} color={C.primary} /> : null}
              </Card>
            ))}
            {status !== 'answering' && status !== 'closed' ? (
              <Button title={m.documents.length ? 'Add another document' : 'Attach a contract'} icon="attach" variant="secondary" onPress={() => router.push(`/business/upload/${matterId}`)} />
            ) : null}
          </View>
          <BusinessNotice />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  checkedHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  next: { gap: 2, padding: S.md, backgroundColor: C.bg, borderRadius: R.sm },
  msg: { padding: S.md, borderRadius: R.md, gap: 2, maxWidth: '90%' },
  mine: { alignSelf: 'flex-end', backgroundColor: C.primarySoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
});
