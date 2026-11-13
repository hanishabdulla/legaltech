import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyCard, FlagChips, Pill, RemedyHeader, StatusBadge, TOPIC_LABELS, dueLabel, useNow, type MatterStatus } from '@/components/remedy';
import { RemedyStaffSignIn } from '@/components/remedy-signin';
import { Card, IconButton, Screen, T } from '@/components/ui';
import { C, DesktopBreakpoint, S } from '@/constants/theme';
import { shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

export default function Lawyer() {
  const { lawyerToken, setLawyerToken } = useSession();
  const me = useQuery(api.sessions.staffMe, lawyerToken ? { token: lawyerToken } : 'skip');
  const wrongRole = !!me && me.role !== 'lawyer' && me.role !== 'admin';

  useEffect(() => {
    if (lawyerToken && (me === null || wrongRole)) setLawyerToken(null);
  }, [lawyerToken, me, wrongRole, setLawyerToken]);

  if (!lawyerToken || me === null || wrongRole) return <RemedyStaffSignIn role="lawyer" onToken={setLawyerToken} />;
  if (me === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  return <Queue token={lawyerToken} name={me.name} onSignOut={() => setLawyerToken(null)} />;
}

type Row = FunctionReturnType<typeof api.lawyer.queue>['open'][number];

function Queue({ token, name, onSignOut }: { token: string; name: string; onSignOut: () => void }) {
  const queue = useQuery(api.lawyer.queue, { token });
  const signOut = useMutation(api.sessions.staffSignOut);
  const now = useNow();
  const { width } = useWindowDimensions();
  const desktop = width >= DesktopBreakpoint;
  const grid = (rows: Row[]) => (
    <View style={desktop ? styles.grid : { gap: S.md }}>
      {rows.map((m) => (
        <View key={m._id} style={desktop ? styles.cell : undefined}>
          <QueueCard m={m} now={now} />
        </View>
      ))}
    </View>
  );
  const waiting = queue?.open.filter((m) => m.status === 'in_review') ?? [];
  const overdue = waiting.filter((m) => m.dueAt && m.dueAt < now).length;

  return (
    <Screen
      wide
      header={
        <RemedyHeader
          title="Review queue"
          subtitle={`${name} · Remedy lawyer`}
          right={<IconButton name="log-out-outline" label="Sign out" onPress={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }} />}
        />
      }>
      {queue === undefined ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      ) : (
        <View style={{ gap: S.xl }}>
          <View style={styles.stats}>
            <Stat label="To review" value={waiting.length} />
            <Stat label="High urgency" value={waiting.filter((m) => m.urgency === 'high').length} tone={C.danger} />
            <Stat label="Overdue" value={overdue} tone={overdue ? C.danger : C.text} />
            <Stat label="Awaiting client" value={queue.open.length - waiting.length} tone={C.warn} />
          </View>
          <View style={{ gap: S.md }}>
            <T kind="heading">Open matters</T>
            {queue.open.length === 0 ? (
              <EmptyCard icon="cafe-outline" title="Queue is clear" text="Flagged matters appear here live when a founder asks a question." />
            ) : (
              grid(queue.open)
            )}
          </View>
          {queue.recent.length ? (
            <View style={{ gap: S.md }}>
              <T kind="heading">Recently checked</T>
              {grid(queue.recent)}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function QueueCard({ m, now }: { m: Row; now: number }) {
  const due = m.status === 'in_review' ? dueLabel(m.dueAt, now) : null;
  return (
    <Card
      onPress={() => router.push(`/lawyer/matter/${m._id}`)}
      style={[{ gap: S.sm, flexGrow: 1 }, (m.urgency === 'high' || due?.overdue) && m.status === 'in_review' && { borderColor: C.danger, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
        {m.urgency === 'high' ? <Pill text="High urgency" fg={C.danger} bg={C.dangerSoft} icon="flash" /> : null}
        <StatusBadge status={m.status as MatterStatus} />
        <T kind="small" muted style={{ marginLeft: 'auto' }}>{m.ref} · {shortDate(m.createdAt)}</T>
      </View>
      <T kind="small" muted>{m.business} · {TOPIC_LABELS[m.topic] ?? m.topic}</T>
      <View style={{ gap: 2 }}>
        {m.lines.map((l, i) => (
          <T key={i} kind={i === 0 ? 'label' : 'small'} muted={i > 0} numberOfLines={2}>{l}</T>
        ))}
      </View>
      <FlagChips codes={m.flagCodes} />
      {due ? (
        <T kind="small" style={{ color: due.overdue ? C.danger : C.muted, fontWeight: '700' }}>⏱ {due.text}</T>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, tone = C.text }: { label: string; value: number; tone?: string }) {
  return (
    <Card style={{ flex: 1, gap: 0, padding: S.md, minWidth: 120 }}>
      <T kind="title" style={{ color: tone }}>{value}</T>
      <T kind="small" muted>{label}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: S.md, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  cell: { flexBasis: '31%', flexGrow: 1, minWidth: 300 },
});
