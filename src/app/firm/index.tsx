import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { EmptyCard, Pill, REFERRAL_STATUS, RemedyHeader, TRIGGER_LABEL, dateTime } from '@/components/remedy';
import { RemedyStaffSignIn } from '@/components/remedy-signin';
import { Card, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

export default function FirmHome() {
  const { firmToken, setFirmToken } = useSession();
  const me = useQuery(api.sessions.staffMe, firmToken ? { token: firmToken } : 'skip');
  const wrongRole = !!me && me.role !== 'firm';
  useEffect(() => {
    if (firmToken && (me === null || wrongRole)) setFirmToken(null);
  }, [firmToken, me, wrongRole, setFirmToken]);

  if (!firmToken || me === null || wrongRole) return <RemedyStaffSignIn role="firm" onToken={setFirmToken} />;
  if (me === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  return <Inbox token={firmToken} name={me.name} onSignOut={() => setFirmToken(null)} />;
}

function Inbox({ token, name, onSignOut }: { token: string; name: string; onSignOut: () => void }) {
  const inbox = useQuery(api.firms.inbox, { token });
  const signOut = useMutation(api.sessions.staffSignOut);
  return (
    <Screen
      wide
      header={
        <RemedyHeader
          title={inbox?.firm?.name ?? 'Partner firm'}
          subtitle={`${name} · Remedy handoff packs`}
          right={<IconButton name="log-out-outline" label="Sign out" onPress={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }} />}
        />
      }>
      {inbox === undefined ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      ) : (
        <View style={{ gap: S.md }}>
          <T kind="heading">Incoming handoff packs</T>
          {inbox.referrals.length === 0 ? (
            <EmptyCard icon="file-tray-outline" title="No referrals yet" text="When a Remedy client chooses your firm and consents to share, their pack appears here live." />
          ) : (
            inbox.referrals.map((r) => {
              const st = REFERRAL_STATUS[r.status];
              return (
                <Card key={r._id} onPress={() => router.push(`/firm/referral/${r._id}`)} style={[{ gap: S.sm }, r.status === 'sent' && { borderColor: C.info, borderWidth: 1.5 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
                    <Pill text={st.text} fg={st.fg} bg={st.bg} />
                    <Pill text={TRIGGER_LABEL[r.trigger]} fg={C.remedy} bg="#E7E9EF" />
                    <T kind="small" muted style={{ marginLeft: 'auto' }}>{dateTime(r.createdAt)}</T>
                  </View>
                  <T kind="label">{r.business}</T>
                  <T kind="small" muted numberOfLines={2}>{r.reason}</T>
                  <View style={{ flexDirection: 'row', gap: S.lg }}>
                    <T kind="small"><Ionicons name="chatbubbles-outline" size={13} /> {r.matters} matter(s)</T>
                    <T kind="small"><Ionicons name="document-outline" size={13} /> {r.documents} document(s)</T>
                    <T kind="small" muted>{r.feeType === 'seed_ready' ? 'Seed-ready introduction' : 'Submission'}</T>
                  </View>
                </Card>
              );
            })
          )}
          <T kind="small" muted center>Demo firm portal. You only see packs the client chose to send to your firm.</T>
        </View>
      )}
    </Screen>
  );
}
