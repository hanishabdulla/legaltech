import { useMutation, useQuery } from 'convex/react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, View } from 'react-native';

import { AiBadge, ClientHeader, NotAdvice } from '@/components/client-chrome';
import { Button, Card, IconBubble, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { daysLeft, longDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';

export default function Plan() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');
  const setStatus = useMutation(api.cases.setActionStatus);

  if (!clientToken) return <Redirect href="/start" />;

  return (
    <Screen header={<ClientHeader title="Action plan" />}>
      {c === undefined ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      ) : (
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <AiBadge approved={c.status === 'approved'} />
            <T kind="title">Sorting out the cause</T>
            <T muted>Emergency help gets you through this week. These steps deal with what caused the crisis, so it doesn’t happen again.</T>
          </View>

          {c.actions.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <IconBubble name="checkmark-done" size={52} />
              <T kind="label" center>Nothing else to do right now</T>
              <T kind="small" muted center>If things change, start a new case or call Leeds Citizens Advice on 0808 278 7878.</T>
            </Card>
          ) : (
            c.actions.map((a) => (
              <ActionCard key={a._id} action={a} onStatus={(status) => setStatus({ token, actionId: a._id, status })} />
            ))
          )}
          <NotAdvice />
        </View>
      )}
    </Screen>
  );
}

function ActionCard({ action: a, onStatus }: { action: Doc<'actions'>; onStatus: (s: 'todo' | 'done' | 'handed_off') => void }) {
  const [showLetter, setShowLetter] = useState(false);
  const left = a.deadline ? daysLeft(a.deadline) : null;
  const done = a.status === 'done';

  return (
    <Card style={[{ gap: S.md }, done && { opacity: 0.7 }]}>
      <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'flex-start' }}>
        <IconBubble name={done ? 'checkmark' : a.deadline ? 'alarm-outline' : 'arrow-redo-outline'} size={40} color={done ? '#fff' : C.primary} bg={done ? C.primary : C.primarySoft} />
        <View style={{ flex: 1, gap: 4 }}>
          <T kind="label">{a.title}</T>
          <T kind="small" muted>{a.detail}</T>
        </View>
      </View>

      {a.deadline && left !== null ? (
        <View style={[styles.deadline, left <= 7 && { backgroundColor: C.dangerSoft }]}>
          <View style={{ alignItems: 'center', minWidth: 52 }}>
            <T kind="title" style={{ color: left <= 7 ? C.danger : C.warn }}>{left}</T>
            <T kind="small" style={{ color: left <= 7 ? C.danger : C.warn, fontWeight: '700' }}>{left === 1 ? 'day' : 'days'}</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T kind="label">Deadline: {longDate(a.deadline)}</T>
            {a.deadlineBasis ? <T kind="small" muted>{a.deadlineBasis}</T> : null}
          </View>
        </View>
      ) : a.deadlineBasis ? (
        <View style={styles.basis}>
          <Ionicons name="time-outline" size={16} color={C.warn} />
          <T kind="small" style={{ flex: 1 }}>{a.deadlineBasis}</T>
        </View>
      ) : null}

      {a.draftLetter ? (
        <View style={{ gap: S.sm }}>
          <Button title={showLetter ? 'Hide draft letter' : 'See draft letter'} variant="secondary" icon="document-text-outline" onPress={() => setShowLetter((s) => !s)} />
          {showLetter ? (
            <>
              <View style={styles.letter}>
                <T kind="small" selectable style={{ lineHeight: 21 }}>{a.draftLetter}</T>
              </View>
              <T kind="small" muted>Fixed template: the pilot has it reviewed by a partner law firm first. Fill in the parts in [brackets].</T>
              <Button title="Copy or share" variant="ghost" icon="share-outline" onPress={() => Share.share({ message: a.draftLetter! })} />
            </>
          ) : null}
        </View>
      ) : null}

      {a.handoffTo ? (
        <View style={styles.handoff}>
          <Ionicons name="people-outline" size={18} color={C.info} />
          <View style={{ flex: 1 }}>
            <T kind="small" style={{ fontWeight: '700' }}>Free help: {a.handoffTo}</T>
            {a.handoffContact ? <T kind="small" muted>{a.handoffContact}</T> : null}
          </View>
          {a.handoffContact ? (
            <Button title="Call" variant="ghost" icon="call-outline" onPress={() => Linking.openURL(`tel:${a.handoffContact!.replace(/\s/g, '')}`)} style={{ minHeight: 40, paddingHorizontal: S.md }} />
          ) : null}
        </View>
      ) : null}

      <Button title={done ? 'Mark as not done' : 'I’ve done this'} variant="ghost" icon={done ? 'arrow-undo-outline' : 'checkmark-done-outline'} onPress={() => onStatus(done ? 'todo' : 'done')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  deadline: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.warnSoft, padding: S.md, borderRadius: R.md },
  basis: { flexDirection: 'row', gap: S.sm, backgroundColor: C.warnSoft, padding: S.md, borderRadius: R.sm },
  letter: { backgroundColor: C.bg, borderRadius: R.sm, padding: S.lg },
  handoff: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.infoSoft, padding: S.md, borderRadius: R.sm },
});
