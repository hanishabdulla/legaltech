import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import {
  Bullets,
  FLAG_LABELS,
  Pill,
  RemedyHeader,
  Section,
  StatusBadge,
  TOPIC_LABELS,
  citeLabel,
  dateTime,
  dueLabel,
  inputStyle,
  openUrl,
  sectorLabel,
  useNow,
  type MatterStatus,
} from '@/components/remedy';
import { Banner, Button, Card, Divider, Ionicons, Screen, T } from '@/components/ui';
import { C, DesktopBreakpoint, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Matter = NonNullable<FunctionReturnType<typeof api.lawyer.getMatter>>;

export default function LawyerMatter() {
  const { matterId } = useLocalSearchParams<{ matterId: Id<'matters'> }>();
  const { lawyerToken } = useSession();
  const token = lawyerToken ?? '';
  const m = useQuery(api.lawyer.getMatter, lawyerToken ? { token, matterId } : 'skip');
  const open = useMutation(api.lawyer.open);
  const { width } = useWindowDimensions();
  const desktop = width >= DesktopBreakpoint;

  useEffect(() => {
    if (lawyerToken) open({ token: lawyerToken, matterId }).catch(() => {});
  }, [lawyerToken, matterId, open]);

  if (!lawyerToken) return <Redirect href="/lawyer" />;
  if (m === undefined) {
    return (
      <Screen wide scroll={false} header={<RemedyHeader title="Matter" back="/lawyer" />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  if (m === null) {
    return (
      <Screen wide header={<RemedyHeader title="Matter" back="/lawyer" />}>
        <Banner tone="warn" icon="alert-circle">This matter isn’t available yet. The AI may still be drafting it.</Banner>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen wide header={<RemedyHeader title={`${m.ref} · ${m.business.name}`} subtitle={TOPIC_LABELS[m.topic] ?? m.topic} back="/lawyer" />}>
        <View style={desktop ? styles.columns : { gap: S.xl }}>
          <View style={desktop ? styles.left : undefined}>
            <Summary m={m} />
          </View>
          <View style={desktop ? styles.right : { gap: S.xl }}>
            <Review key={m._id} m={m} token={token} />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** The one-page matter summary (mvp2.md §6.3). */
function Summary({ m }: { m: Matter }) {
  const now = useNow();
  const due = dueLabel(m.dueAt, now);
  const b = m.business;
  return (
    <Card style={{ gap: S.lg }}>
      <View style={{ gap: S.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
          <T kind="caption" style={{ color: C.remedy, flex: 1 }}>Remedy matter summary</T>
          <T kind="label" style={{ fontVariant: ['tabular-nums'] }}>{m.ref}</T>
        </View>
        <T kind="label">
          {b.name} · {sectorLabel(b.sector)} · {b.headcount} staff · {b.stage[0].toUpperCase() + b.stage.slice(1)} · {b.plan === 'pro' ? 'Pro' : 'Starter'}
        </T>
        <T kind="small" muted>
          Received {dateTime(m.createdAt)}
          {m.dueAt ? ` · Due ${dateTime(m.dueAt)}` : ''} · Topic: {TOPIC_LABELS[m.topic] ?? m.topic}
          {b.companyNumber ? ` · Co. no. ${b.companyNumber}` : ''} · Growth score {b.traction}
        </T>
        <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap', marginTop: S.xs }}>
          <StatusBadge status={m.status as MatterStatus} checkedBy={m.checkedBy} />
          {m.urgency === 'high' ? <Pill text="High urgency" fg={C.danger} bg={C.dangerSoft} icon="flash" /> : null}
          {due && m.status === 'in_review' ? <Pill text={due.text} fg={due.overdue ? C.danger : C.muted} bg={due.overdue ? C.dangerSoft : '#EEF0EE'} icon="timer-outline" /> : null}
          {m.assignedTo ? <Pill text={`Assigned: ${m.assignedTo}`} fg={C.info} bg={C.infoSoft} icon="person" /> : null}
        </View>
      </View>
      <Divider />

      <Section n={1} title="The question (client’s words)">
        <T selectable>“{m.question}”</T>
      </Section>

      <Section n={2} title="Facts we have">
        {m.summary?.facts.length ? (
          m.summary.facts.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
              <Pill text={f.source} fg={f.source === 'document' ? C.info : C.primary} bg={f.source === 'document' ? C.infoSoft : C.primarySoft} />
              <T kind="small" style={{ flex: 1 }}>{f.fact}</T>
            </View>
          ))
        ) : (
          <T kind="small" muted>{m.summary ? 'None stated beyond the question.' : 'Summary being written…'}</T>
        )}
      </Section>

      <Section n={3} title="What we don’t know">
        <Bullets items={m.summary?.unknowns ?? []} empty="Nothing flagged as missing." />
      </Section>

      <Section n={4} title="AI draft answer + legislation relied on">
        {m.draft ? (
          <>
            <T kind="small" muted>Confidence {Math.round(m.draft.confidence * 100)}% · {m.draft.model}</T>
            <T kind="small" selectable>{m.draft.answer}</T>
            {m.draft.citations.map((c) => (
              <Pressable key={c.url} onPress={() => openUrl(c.url)} style={styles.cite}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <Ionicons name="book-outline" size={15} color={C.info} />
                  <T kind="small" style={{ color: C.info, fontWeight: '700', flex: 1 }}>{citeLabel(c)} · {c.heading}</T>
                  <T kind="small" style={{ color: C.info }}>open source ↗</T>
                </View>
                <T kind="small" muted numberOfLines={4}>{c.excerpt}</T>
                <T kind="small" muted>{c.source === 'fixture' ? 'Demo fixture summary, not official text' : `Version ${c.versionDate}`}</T>
              </Pressable>
            ))}
            {!m.draft.citations.length ? <Banner tone="warn" icon="alert-circle">No verified citations. Check every legal statement.</Banner> : null}
          </>
        ) : (
          <Banner tone="warn" icon="alert-circle">The AI couldn’t produce a reliable draft. Please write the answer.</Banner>
        )}
      </Section>

      <Section n={5} title="Flags and questions for the lawyer">
        {m.flags.map((f) => (
          <View key={f.code} style={{ gap: 2 }}>
            <T kind="small" style={{ fontWeight: '700', color: C.warn }}>⚑ {FLAG_LABELS[f.code] ?? f.code}</T>
            <T kind="small">{f.reason}</T>
            <T kind="small" muted>→ {f.questionForLawyer}</T>
          </View>
        ))}
        {m.summary?.questionsForLawyer.length ? <Bullets items={m.summary.questionsForLawyer} /> : null}
      </Section>

      <Section n={6} title="Documents (clauses highlighted)">
        {m.documents.length ? (
          m.documents.map((d) => (
            <View key={d._id} style={{ gap: 4 }}>
              <Pressable onPress={() => d.url && openUrl(d.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Ionicons name="document-attach-outline" size={16} color={C.primary} />
                <T kind="small" style={{ fontWeight: '700', textTransform: 'capitalize', flex: 1 }}>{d.kind.replace(/_/g, ' ')}{d.submitted ? '' : ' (not yet sent by client)'}</T>
                {d.url ? <T kind="small" style={{ color: C.info }}>open ↗</T> : null}
              </Pressable>
              <T kind="small" muted>{d.summary}</T>
              {d.clauses.map((c, i) => (
                <T key={i} kind="small">• <T kind="small" style={{ fontWeight: '700', color: c.risk === 'high' ? C.danger : c.risk === 'medium' ? C.warn : C.text }}>{c.title}</T>: {c.why}</T>
              ))}
            </View>
          ))
        ) : (
          <T kind="small" muted>No documents.</T>
        )}
      </Section>

      <Section n={7} title="Suggested reply options">
        <Bullets items={m.summary?.replyOptions ?? []} empty="No options suggested." />
      </Section>
    </Card>
  );
}

function Review({ m, token }: { m: Matter; token: string }) {
  const review = useMutation(api.lawyer.review);
  const initial = m.finalAnswer ?? m.draft?.answer ?? '';
  const [answer, setAnswer] = useState(initial);
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
        { approve: 'Approved and sent to the client.', edit_approve: 'Edited answer approved and sent.', request_info: 'Request sent. The matter waits for the client.', recommend_firm: 'Firm recommended. The client will see partner firms.' }[action],
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card>
        <T kind="heading">Answer to the client</T>
        <T kind="small" muted>{edited ? 'Edited from the AI draft. Both versions are kept.' : 'AI draft. Edit anything before approving.'}</T>
        <TextInput value={answer} onChangeText={setAnswer} multiline style={[inputStyle.input, inputStyle.textarea, { minHeight: 220 }]} placeholder="Write the answer…" placeholderTextColor={C.faint} />
        {m.summary?.replyOptions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {m.summary.replyOptions.map((o, i) => (
              <Button key={i} title={`Use option ${String.fromCharCode(65 + i)}`} variant="ghost" icon="copy-outline" onPress={() => setAnswer(o.replace(/^[AB][:.)]\s*/, ''))} style={{ minHeight: 40 }} />
            ))}
            {edited && m.draft ? <Button title="Reset to AI draft" variant="ghost" icon="refresh" onPress={() => setAnswer(m.draft!.answer)} style={{ minHeight: 40 }} /> : null}
          </View>
        ) : null}

        <View style={{ gap: S.sm }}>
          <T kind="label">Message to the client (for “Request info”)</T>
          <TextInput value={message} onChangeText={setMessage} multiline style={[inputStyle.input, inputStyle.textarea, { minHeight: 80 }]} placeholder="e.g. Who decides their hours? Can they send someone else?" placeholderTextColor={C.faint} />
        </View>
        <View style={{ gap: S.sm }}>
          <T kind="label">Shareable note (goes to a partner firm if the client consents)</T>
          <TextInput value={shareableNote} onChangeText={setShareableNote} multiline style={[inputStyle.input, inputStyle.textarea, { minHeight: 70 }]} placeholderTextColor={C.faint} />
        </View>
        <View style={{ gap: S.sm }}>
          <T kind="label">Private note (Remedy only, never shared)</T>
          <TextInput value={privateNote} onChangeText={setPrivateNote} multiline style={[inputStyle.input, inputStyle.textarea, { minHeight: 70 }]} placeholderTextColor={C.faint} />
        </View>

        {!actionable ? <Banner tone="success" icon="checkmark-circle">{m.status === 'lawyer_checked' ? `Checked by ${m.checkedBy}. You can still update it.` : 'Firm recommended.'}</Banner> : null}
        <View style={styles.actions}>
          {edited ? (
            <Button title="Edit and approve" icon="create-outline" onPress={() => act('edit_approve')} loading={busy === 'edit_approve'} disabled={!!busy || !answer.trim()} style={styles.action} />
          ) : (
            <Button title="Approve" icon="checkmark" onPress={() => act('approve')} loading={busy === 'approve'} disabled={!!busy || !answer.trim()} style={styles.action} />
          )}
          <Button title="Request info" icon="chatbubble-ellipses-outline" variant="secondary" onPress={() => act('request_info')} loading={busy === 'request_info'} disabled={!!busy || !message.trim()} style={styles.action} />
          <Button title="Recommend firm" icon="business-outline" variant="secondary" onPress={() => act('recommend_firm')} loading={busy === 'recommend_firm'} disabled={!!busy} style={styles.action} />
        </View>
        {done ? <Banner tone="success" icon="checkmark-circle">{done}</Banner> : null}
        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
      </Card>

      {m.messages.length ? (
        <Card>
          <T kind="heading">Messages</T>
          {m.messages.map((x) => (
            <View key={x._id} style={{ gap: 2 }}>
              <T kind="small" muted>{x.from === 'client' ? 'Client' : x.name ?? 'Lawyer'} · {dateTime(x.at)}</T>
              <T kind="small">{x.text}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {m.reviews.length ? (
        <Card>
          <T kind="heading">Notes</T>
          {m.reviews.filter((r) => r.privateNote || r.shareableNote).map((r) => (
            <View key={r._id} style={{ gap: 2 }}>
              <T kind="small" muted>{r.by} · {r.action.replace('_', ' ')} · {dateTime(r.at)}</T>
              {r.shareableNote ? <T kind="small"><T kind="small" style={{ fontWeight: '700' }}>Shareable: </T>{r.shareableNote}</T> : null}
              {r.privateNote ? <T kind="small"><T kind="small" style={{ fontWeight: '700' }}>Private: </T>{r.privateNote}</T> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <T kind="heading">Audit trail</T>
        {m.log.map((l) => (
          <View key={l._id} style={{ flexDirection: 'row', gap: S.sm }}>
            <T kind="small" muted style={{ width: 120 }}>{dateTime(l.at)}</T>
            <T kind="small" style={{ flex: 1 }}>{l.event.replace(/_/g, ' ')}</T>
            <T kind="small" muted numberOfLines={1} style={{ maxWidth: 140 }}>{l.actor.replace(/^staff:.*/, 'staff')}</T>
          </View>
        ))}
      </Card>
      <Button title="Back to queue" variant="ghost" icon="list" onPress={() => router.replace('/lawyer')} />
    </>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: S.xl, alignItems: 'flex-start' },
  left: { flex: 1.1, gap: S.xl },
  right: { flex: 1, gap: S.xl },
  cite: { gap: 4, padding: S.md, borderRadius: R.sm, backgroundColor: C.infoSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  action: { flexGrow: 1, minWidth: 160 },
});
