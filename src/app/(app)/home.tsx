import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { VoucherCard } from '@/components/voucher-card';
import { Button, Card, IconBubble, IconButton, Ionicons, Screen, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { money, voucherStatus } from '@/lib/format';
import { useSession, useUserId } from '@/lib/session';
import { api } from '@convex/_generated/api';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const userId = useUserId();
  const { signOut } = useSession();
  const me = useQuery(api.users.me, { userId });
  const vouchers = useQuery(api.vouchers.list, { userId });
  const resetDemo = useMutation(api.vouchers.resetDemo);

  const active = (vouchers ?? []).filter((v) => voucherStatus(v) === 'active');
  const activeTotal = active.reduce((sum, v) => sum + v.valuePence, 0);

  function confirm(title: string, message: string, action: string, onYes: () => void) {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onYes();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, style: 'destructive', onPress: onYes },
    ]);
  }

  return (
    <Screen
      header={
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T kind="small" muted>{greeting()}</T>
            <T kind="title">{me?.firstName ?? ' '}</T>
          </View>
          <IconButton
            name="log-out-outline"
            label="Sign out"
            onPress={() => confirm('Sign out?', 'Your vouchers stay saved to your account.', 'Sign out', signOut)}
          />
        </View>
      }>
      <View style={{ gap: S.xl }}>
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <IconBubble name="basket" color="#fff" bg="rgba(255,255,255,0.18)" size={52} />
          <View style={{ gap: S.sm }}>
            <T kind="title" style={{ color: '#fff' }}>Need help with food or energy?</T>
            <T style={{ color: 'rgba(255,255,255,0.88)' }}>
              Answer a few quick questions. If you qualify, you’ll get a supermarket voucher straight away.
            </T>
          </View>
          <View style={styles.heroMeta}>
            <Meta icon="time-outline" text="About 3 minutes" />
            <Meta icon="lock-closed-outline" text="Private" />
          </View>
          <Button
            title="Check what I can get"
            icon="arrow-forward"
            variant="secondary"
            onPress={() => router.push('/check')}
            style={{ backgroundColor: '#fff' }}
          />
        </View>

        <View style={{ gap: S.md }}>
          <View style={styles.sectionHead}>
            <T kind="heading">Your vouchers</T>
            {vouchers?.length ? (
              <Pressable onPress={() => router.push('/wallet')} hitSlop={8}>
                <T kind="label" style={{ color: C.primary }}>See all</T>
              </Pressable>
            ) : null}
          </View>

          {vouchers === undefined ? (
            <Card style={{ height: 170 }}><View /></Card>
          ) : active.length ? (
            <>
              <T muted>
                {active.length} active {active.length === 1 ? 'voucher' : 'vouchers'} · {money(activeTotal)} to spend
              </T>
              <VoucherCard voucher={active[0]} onPress={() => router.push(`/voucher/${active[0]._id}`)} />
            </>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <IconBubble name="wallet-outline" color={C.muted} bg={C.bg} />
              <T kind="label" center>No active vouchers</T>
              <T kind="small" muted center>Vouchers you get will be saved here, with how long they last.</T>
            </Card>
          )}
        </View>

        <View style={{ gap: S.md }}>
          <T kind="heading">More help</T>
          <Card style={{ padding: 0, gap: 0 }}>
            <HelpRow
              icon="chatbubbles-outline"
              title="Talk to Citizens Advice"
              detail="Free, confidential advice on money, benefits and housing"
              onPress={() => Linking.openURL('https://www.citizensadvice.org.uk/')}
            />
            <View style={styles.rowDivider} />
            <HelpRow
              icon="call-outline"
              title="In danger? Call 999"
              detail="Domestic abuse helpline: 0808 2000 247, free, 24 hours"
              onPress={() => Linking.openURL('tel:08082000247')}
            />
          </Card>
        </View>

        <View style={{ alignItems: 'center', gap: S.sm, paddingTop: S.sm }}>
          <T kind="small" muted center>Prototype for the LegalTech in Leeds Hackathon. Vouchers are not real.</T>
          {me?.maskedNi ? <T kind="small" muted>Signed in as {me.maskedNi}</T> : null}
          <Pressable
            hitSlop={8}
            onPress={() => confirm('Reset demo?', 'This deletes your checks and vouchers so you can start again.', 'Reset', () => resetDemo({ userId }))}>
            <T kind="small" style={{ color: C.danger, fontWeight: '600' }}>Reset demo data</T>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.85)" />
      <T kind="small" style={{ color: 'rgba(255,255,255,0.85)' }}>{text}</T>
    </View>
  );
}

function HelpRow({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.helpRow, pressed && { backgroundColor: C.bg }]}>
      <IconBubble name={icon} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <T kind="label">{title}</T>
        <T kind="small" muted>{detail}</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  hero: { backgroundColor: C.primary, borderRadius: R.lg, padding: S.xl, gap: S.lg, overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -90, top: -90, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroMeta: { flexDirection: 'row', gap: S.lg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 68 },
});
