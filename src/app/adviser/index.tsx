import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { OutcomePill, type Outcome } from '@/components/case-bits';
import { Banner, Button, Card, Chip, IconBubble, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, DesktopBreakpoint, R, S } from '@/constants/theme';
import { errorMessage, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

const ORGS = ['Leeds Citizens Advice', 'Community Hub (Harehills)', 'Uni law clinic'];

export default function Adviser() {
  const { staffToken, setStaffToken } = useSession();
  const me = useQuery(api.sessions.staffMe, staffToken ? { token: staffToken } : 'skip');

  useEffect(() => {
    if (staffToken && me === null) setStaffToken(null);
  }, [staffToken, me, setStaffToken]);

  if (!staffToken || me === null) return <SignIn onToken={setStaffToken} />;
  if (me === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  return <Queue token={staffToken} name={me.name} organisation={me.organisation} onSignOut={() => setStaffToken(null)} />;
}

function Queue({ token, name, organisation, onSignOut }: { token: string; name: string; organisation: string; onSignOut: () => void }) {
  const queue = useQuery(api.adviser.queue, { token });
  const signOut = useMutation(api.sessions.staffSignOut);
  const { width } = useWindowDimensions();
  const desktop = width >= DesktopBreakpoint;
  const grid = (rows: Row[]) => (
    <View style={desktop ? styles.grid : { gap: S.md }}>
      {rows.map((c) => (
        <View key={c._id} style={desktop ? styles.cell : undefined}>
          <QueueCard c={c} />
        </View>
      ))}
    </View>
  );

  return (
    <Screen
      wide
      header={
        <View style={styles.header}>
          <IconButton name="arrow-back" label="Back to client app" onPress={() => router.replace('/start')} />
          <View style={{ flex: 1 }}>
            <T kind="heading">Adviser queue</T>
            <T kind="small" muted>{name} · {organisation}</T>
          </View>
          <IconButton name="log-out-outline" label="Sign out" onPress={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }} />
        </View>
      }>
      {queue === undefined ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      ) : (
        <View style={{ gap: S.xl }}>
          <View style={styles.stats}>
            <Stat label="Waiting" value={queue.open.length} />
            <Stat label="Urgent" value={queue.open.filter((c) => c.urgency === 'urgent').length} tone={C.danger} />
            <Stat label="Decided" value={queue.recent.length} tone={C.primary} />
          </View>

          <View style={{ gap: S.md }}>
            <T kind="heading">To review</T>
            {queue.open.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
                <IconBubble name="cafe-outline" size={52} />
                <T kind="label" center>Queue is clear</T>
                <T kind="small" muted center>New cases appear here live when someone sends theirs.</T>
              </Card>
            ) : (
              grid(queue.open)
            )}
          </View>

          {queue.recent.length ? (
            <View style={{ gap: S.md }}>
              <T kind="heading">Recently decided</T>
              {grid(queue.recent)}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

type Row = {
  _id: string;
  status: string;
  urgency: 'urgent' | 'standard';
  safeguarding: boolean;
  adviserSummary: string;
  flags: string[];
  submittedAt: number;
  outcomes: { scheme: string; name: string; outcome: string }[];
  pending: number;
};

function QueueCard({ c }: { c: Row }) {
  const lines = c.adviserSummary.split('\n').filter(Boolean).slice(0, 3);
  return (
    <Card onPress={() => router.push(`/adviser/case/${c._id}`)} style={[{ gap: S.sm, flexGrow: 1 }, c.urgency === 'urgent' && { borderColor: C.danger, borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
        {c.safeguarding ? <Tag icon="heart" text="Safeguarding" color={C.danger} bg={C.dangerSoft} /> : null}
        {c.urgency === 'urgent' ? <Tag icon="flash" text="Urgent" color={C.danger} bg={C.dangerSoft} /> : null}
        {c.pending ? <Tag icon="hourglass-outline" text={`${c.pending} to decide`} color={C.warn} bg={C.warnSoft} /> : <Tag icon="checkmark" text={c.status.replace('_', ' ')} color={C.primary} bg={C.primarySoft} />}
        <T kind="small" muted style={{ marginLeft: 'auto' }}>{shortDate(c.submittedAt)}</T>
      </View>
      <View style={{ gap: 2 }}>
        {lines.map((l, i) => (
          <T key={i} kind={i === 0 ? 'label' : 'small'} muted={i > 0}>{l}</T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {c.outcomes.map((o) => (
          <View key={o.scheme} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <T kind="small" muted>{o.name}</T>
            <OutcomePill outcome={o.outcome as Outcome} />
          </View>
        ))}
      </View>
      {c.flags.length ? <T kind="small" style={{ color: C.warn }}>⚑ {c.flags[0]}{c.flags.length > 1 ? ` (+${c.flags.length - 1})` : ''}</T> : null}
    </Card>
  );
}

function Tag({ icon, text, color, bg }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={color} />
      <T kind="small" style={{ color, fontWeight: '700', textTransform: 'capitalize' }}>{text}</T>
    </View>
  );
}

function Stat({ label, value, tone = C.text }: { label: string; value: number; tone?: string }) {
  return (
    <Card style={{ flex: 1, gap: 0, padding: S.md }}>
      <T kind="title" style={{ color: tone }}>{value}</T>
      <T kind="small" muted>{label}</T>
    </Card>
  );
}

function SignIn({ onToken }: { onToken: (t: string) => void }) {
  const signIn = useMutation(api.sessions.staffSignIn);
  const [name, setName] = useState('');
  const [org, setOrg] = useState(ORGS[0]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      onToken(await signIn({ name, organisation: org, code }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={<IconButton name="arrow-back" label="Back" onPress={() => router.replace('/start')} />}
        footer={<Button title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} disabled={!name.trim() || !code.trim()} />}>
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.md }}>
            <IconBubble name="briefcase" size={52} color="#fff" bg={C.info} />
            <T kind="display">Adviser sign in</T>
            <T muted>For registered referrers: review cases, approve referrals and edit AI case notes.</T>
          </View>
          <View style={{ gap: S.sm }}>
            <T kind="label">Your name</T>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Priya" placeholderTextColor={C.faint} style={styles.input} />
          </View>
          <View style={{ gap: S.sm }}>
            <T kind="label">Organisation</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {ORGS.map((o) => <Chip key={o} label={o} selected={org === o} onPress={() => setOrg(o)} />)}
            </View>
          </View>
          <View style={{ gap: S.sm }}>
            <T kind="label">Access code</T>
            <TextInput value={code} onChangeText={setCode} placeholder="Demo code: LEEDS" placeholderTextColor={C.faint} autoCapitalize="characters" style={styles.input} />
          </View>
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          <Banner tone="info" icon="information-circle">Demo sign-in. The pilot uses proper staff accounts with roles.</Banner>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stats: { flexDirection: 'row', gap: S.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  cell: { flexBasis: '31%', flexGrow: 1, minWidth: 300 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  input: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, paddingHorizontal: S.lg, height: 54, fontSize: 17, color: C.text },
});
