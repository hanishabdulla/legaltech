import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OutcomePill, SchemeCard, type Outcome } from '@/components/case-bits';
import { Banner, Button, Card, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage, longDate, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const SOURCE_LABEL: Record<string, string> = { client: 'Client said', document: 'From document', adviser: 'Adviser' };

export default function AdviserCase() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { staffToken } = useSession();
  const token = staffToken ?? '';
  const c = useQuery(api.adviser.getCase, staffToken ? { token, caseId } : 'skip');
  const open = useMutation(api.adviser.open);
  const editNote = useMutation(api.adviser.editNote);
  const requestInfo = useMutation(api.adviser.requestInfo);
  const decide = useMutation(api.adviser.decideReferral);

  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState<string | null>(null);

  useEffect(() => {
    if (c?.status === 'submitted') open({ token, caseId }).catch(() => {});
  }, [c?.status, open, token, caseId]);

  if (!staffToken) return <Redirect href="/adviser" />;
  if (c === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  if (c === null) return <Redirect href="/adviser" />;

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

  const pending = c.referrals.filter((r) => r.status === 'pending');

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <IconButton name="arrow-back" label="Back to queue" onPress={() => (router.canGoBack() ? router.back() : router.replace('/adviser'))} />
          <View style={{ flex: 1 }}>
            <T kind="heading">Case review</T>
            <T kind="small" muted>Sent {shortDate(c.submittedAt ?? c.createdAt)} · {c.status.replace('_', ' ')}</T>
          </View>
        </View>
      }
      footer={
        pending.length > 1 ? (
          <Button
            title={`Approve all ${pending.length} referrals`}
            icon="checkmark-done"
            loading={busy === 'all'}
            onPress={() => run('all', async () => { for (const r of pending) await decide({ token, referralId: r._id, decision: 'approve' }); })}
          />
        ) : undefined
      }>
      <View style={{ gap: S.xl }}>
        {c.safeguardingFlag ? <Banner tone="danger" icon="heart" title="Safeguarding">{c.safeguardingFlag}</Banner> : null}
        {c.urgency === 'urgent' ? <Banner tone="danger" icon="flash" title="Urgent">Little or no food or fuel, or a risk flag. Prioritise this case.</Banner> : null}

        {c.adviserSummary ? (
          <Card style={{ gap: 4 }}>
            <T kind="caption">AI summary</T>
            {c.adviserSummary.split('\n').map((l, i) => <T key={i} kind={i === 0 ? 'label' : 'body'}>{l}</T>)}
          </Card>
        ) : null}

        {c.adviserFlags.length ? (
          <View style={{ gap: S.sm }}>
            {c.adviserFlags.map((f) => <Banner key={f} tone="warn" icon="flag">{f}</Banner>)}
          </View>
        ) : null}

        {/* Referrals: the decision point */}
        <View style={{ gap: S.md }}>
          <T kind="heading">Referrals</T>
          {c.referrals.length === 0 ? <T muted>No referrals were requested.</T> : null}
          {c.referrals.map((r) => {
            const e = c.eligibility.find((x) => x.scheme === r.scheme);
            return (
              <Card key={r._id} style={{ gap: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <T kind="label" style={{ flex: 1 }}>{r.info?.name ?? r.scheme}</T>
                  {e ? <OutcomePill outcome={e.outcome as Outcome} /> : null}
                </View>
                {r.status === 'pending' ? (
                  rejecting === r._id ? (
                    <View style={{ gap: S.sm }}>
                      <TextInput value={reason} onChangeText={setReason} placeholder="Reason (the client will see this)" placeholderTextColor={C.faint} style={styles.input} multiline />
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <Button title="Confirm reject" variant="danger" loading={busy === r._id} onPress={() => run(r._id, async () => { await decide({ token, referralId: r._id, decision: 'reject', reason }); setRejecting(null); setReason(''); })} style={{ flex: 1 }} />
                        <Button title="Cancel" variant="ghost" onPress={() => setRejecting(null)} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      <Button title="Approve" icon="checkmark" loading={busy === r._id} onPress={() => run(r._id, () => decide({ token, referralId: r._id, decision: 'approve' }))} style={{ flex: 1 }} />
                      <Button title="Reject" variant="danger" onPress={() => setRejecting(r._id)} />
                    </View>
                  )
                ) : (
                  <View style={{ gap: 2 }}>
                    <T kind="small" style={{ color: r.status === 'rejected' ? C.danger : C.primary, fontWeight: '700', textTransform: 'capitalize' }}>
                      {r.status}{r.decidedByName ? ` by ${r.decidedByName}` : ''}{r.decidedAt ? ` · ${shortDate(r.decidedAt)}` : ''}
                    </T>
                    {r.reason ? <T kind="small" muted>{r.reason}</T> : null}
                  </View>
                )}
                <Pressable onPress={() => setShowPayload(showPayload === r._id ? null : r._id)} hitSlop={6}>
                  <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>{showPayload === r._id ? 'Hide' : 'Show'} pre-filled form fields</T>
                </Pressable>
                {showPayload === r._id ? (
                  <View style={styles.code}>
                    {Object.entries(r.payload as Record<string, unknown>).map(([k, val]) => (
                      <T key={k} kind="small" selectable>
                        <T kind="small" style={{ fontWeight: '700' }}>{k}: </T>
                        {Array.isArray(val) ? val.join(', ') || '—' : val === null || val === '' ? '—' : String(val)}
                      </T>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

        {/* Facts with sources */}
        <View style={{ gap: S.md }}>
          <T kind="heading">Facts</T>
          <Card style={{ gap: 0, padding: 0 }}>
            {c.chips.map((f, i) => (
              <View key={`${f.key}-${i}`} style={[styles.factRow, i > 0 && styles.factBorder]}>
                <T style={{ flex: 1 }}>{f.label}</T>
                <View style={[styles.source, f.source === 'document' && { backgroundColor: C.infoSoft }]}>
                  <Ionicons name={f.source === 'document' ? 'document-text-outline' : f.source === 'adviser' ? 'person-outline' : 'chatbubble-outline'} size={12} color={f.source === 'document' ? C.info : C.muted} />
                  <T kind="small" style={{ color: f.source === 'document' ? C.info : C.muted }}>{SOURCE_LABEL[f.source] ?? f.source}</T>
                </View>
              </View>
            ))}
          </Card>
        </View>

        {c.documents.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Documents</T>
            {c.documents.map((d) => (
              <Card key={d._id} style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }} onPress={d.url ? () => Linking.openURL(d.url!) : undefined}>
                {d.url ? <Image source={{ uri: d.url }} style={styles.thumb} contentFit="cover" /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <T kind="label">{d.kind.replace(/_/g, ' ')}</T>
                  <T kind="small" muted>{d.summary ?? 'Reading…'}</T>
                  <T kind="small" style={{ color: d.confirmedByClient ? C.primary : C.warn, fontWeight: '700' }}>
                    {d.confirmedByClient ? 'Confirmed by client' : 'Not confirmed'} · {Math.round(d.confidence * 100)}% AI confidence
                  </T>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Rule trace */}
        <View style={{ gap: S.md }}>
          <T kind="heading">Pre-check (rules)</T>
          {c.eligibility.map((e) => (
            <SchemeCard key={e._id} name={e.info?.name ?? e.scheme} who={e.rulesetVersion} outcome={e.outcome as Outcome} toFinish={e.toFinish} trace={e.trace} flags={e.flags} />
          ))}
        </View>

        {/* Editable case note */}
        <View style={{ gap: S.md }}>
          <T kind="heading">Case note</T>
          <T kind="small" muted>Drafted by AI. Edit before approving; edits are logged.</T>
          <TextInput value={note ?? c.caseNote ?? ''} onChangeText={setNote} multiline textAlignVertical="top" style={[styles.input, { minHeight: 160 }]} />
          {note !== null && note !== c.caseNote ? (
            <Button title="Save note" icon="save-outline" variant="secondary" loading={busy === 'note'} onPress={() => run('note', async () => { await editNote({ token, caseId, caseNote: note }); setNote(null); })} />
          ) : null}
        </View>

        {c.actions.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Action plan given to the client</T>
            {c.actions.map((a) => (
              <Card key={a._id} style={{ gap: 4 }}>
                <T kind="label">{a.title}</T>
                {a.deadline ? <T kind="small" style={{ color: C.warn, fontWeight: '700' }}>Deadline {longDate(a.deadline)}</T> : null}
                {a.handoffTo ? <T kind="small" muted>Hand off: {a.handoffTo}</T> : null}
              </Card>
            ))}
          </View>
        ) : null}

        {/* Request info */}
        <View style={{ gap: S.md }}>
          <T kind="heading">Ask the client for something</T>
          <TextInput value={message} onChangeText={setMessage} placeholder="e.g. Please add a photo of your sanction letter." placeholderTextColor={C.faint} multiline style={[styles.input, { minHeight: 70 }]} />
          <Button title="Send request" variant="secondary" icon="chatbubble-ellipses-outline" disabled={!message.trim()} loading={busy === 'msg'} onPress={() => run('msg', async () => { await requestInfo({ token, caseId, message }); setMessage(''); })} />
          {c.adviserMessage ? <T kind="small" muted>Last request: “{c.adviserMessage}”</T> : null}
        </View>

        {/* Audit trail */}
        <View style={{ gap: S.sm }}>
          <T kind="heading">Audit trail</T>
          <Card style={{ gap: 6 }}>
            {c.log.map((l) => (
              <View key={l._id} style={{ flexDirection: 'row', gap: S.sm }}>
                <T kind="small" muted style={{ width: 92 }}>{new Date(l.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {shortDate(l.at)}</T>
                <T kind="small" style={{ flex: 1 }}>
                  <T kind="small" style={{ fontWeight: '700' }}>{l.actor.startsWith('staff:') ? 'adviser' : l.actor}</T> {l.event.replace(/_/g, ' ')}
                </T>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, padding: S.md, fontSize: 15, lineHeight: 21, color: C.text },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.md },
  factBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  code: { backgroundColor: C.bg, borderRadius: R.sm, padding: S.md, gap: 4 },
  thumb: { width: 56, height: 56, borderRadius: R.sm, backgroundColor: C.bg },
});
