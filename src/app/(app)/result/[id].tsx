import { useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, IconBubble, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, R, RETAILER_COLORS, S } from '@/constants/theme';
import { errorMessage, money } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const RETAILERS = ['Tesco', 'Asda', 'Sainsbury’s', 'Aldi', 'Lidl', 'Morrisons', 'Co-op'];

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const result = useQuery(api.assessments.get, { userId, assessmentId: id as Id<'assessments'> });
  const claim = useMutation(api.vouchers.claim);

  const [retailer, setRetailer] = useState('Tesco');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);

  if (result === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </Screen>
    );
  }
  if (result === null) {
    return (
      <Screen>
        <Banner tone="warn" icon="alert-circle" title="We couldn’t find that check">
          It may belong to a different account.
        </Banner>
        <Button title="Go home" onPress={() => router.replace('/home')} style={{ marginTop: S.lg }} />
      </Screen>
    );
  }

  const d = result.decision;
  const claimed = result.vouchers.length > 0;
  const total = d.foodValuePence + d.fuelValuePence;

  async function getVoucher() {
    setError(null);
    setBusy(true);
    try {
      const voucherId = await claim({ userId, assessmentId: result!._id, retailer });
      router.replace('/home');
      router.push(`/voucher/${voucherId}?fresh=1`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const footer = d.eligible ? (
    claimed ? (
      <Button title="Open my wallet" icon="wallet-outline" onPress={() => { router.replace('/home'); router.push('/wallet'); }} />
    ) : (
      <Button title={`Get my ${money(total)} in vouchers`} icon="arrow-forward" onPress={getVoucher} loading={busy} />
    )
  ) : (
    <Button title="Back to home" onPress={() => router.replace('/home')} />
  );

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <IconButton name="close" label="Close" onPress={() => router.replace('/home')} />
        </View>
      }
      footer={footer}>
      <View style={{ gap: S.xl }}>
        {d.safeguarding ? (
          <Banner tone="danger" icon="heart" title="Your safety comes first">
            {d.safeguarding}
          </Banner>
        ) : null}

        <View style={{ gap: S.md }}>
          <IconBubble
            name={d.eligible ? 'checkmark' : 'information'}
            size={60}
            color={d.eligible ? '#fff' : C.info}
            bg={d.eligible ? C.primary : C.infoSoft}
          />
          <T kind="display">{d.headline}</T>
          <T muted>{d.summary}</T>
        </View>

        {d.eligible ? (
          <Card style={{ gap: S.md }}>
            <AmountRow icon="basket" label="Supermarket food voucher" value={money(d.foodValuePence)} sub="Valid for 30 days" />
            {d.fuelValuePence > 0 ? (
              <AmountRow icon="flash" label="Energy top-up voucher" value={money(d.fuelValuePence)} sub="For prepayment meters · valid for 90 days" />
            ) : null}
          </Card>
        ) : null}

        {d.eligible && !claimed ? (
          <View style={{ gap: S.md }}>
            <View style={{ gap: 2 }}>
              <T kind="heading">Where would you like to shop?</T>
              <T kind="small" muted>Pick the supermarket that’s easiest for you to get to.</T>
            </View>
            <View style={styles.grid}>
              {RETAILERS.map((r) => {
                const on = r === retailer;
                const color = RETAILER_COLORS[r];
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setRetailer(r)}
                    style={[styles.store, on && { borderColor: color, backgroundColor: `${color}12` }]}>
                    <View style={[styles.storeDot, { backgroundColor: color }]}>
                      <T kind="label" style={{ color: '#fff' }}>{r[0]}</T>
                    </View>
                    <T kind="label" style={{ flex: 1 }} numberOfLines={1}>{r}</T>
                    {on ? <Ionicons name="checkmark-circle" size={22} color={color} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

        {d.reasons.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Why</T>
            <View style={{ gap: S.sm }}>
              {d.reasons.map((r) => (
                <View key={r} style={styles.bullet}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={C.primary} style={{ marginTop: 1 }} />
                  <T style={{ flex: 1 }}>{r}</T>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {d.nextSteps.length ? (
          <View style={{ gap: S.md }}>
            <View style={{ gap: 2 }}>
              <T kind="heading">Other help you could get</T>
              <T kind="small" muted>Picked for your situation.</T>
            </View>
            <View style={{ gap: S.sm + 2 }}>
              {d.nextSteps.map((s) => (
                <Card key={s.title} style={{ gap: 4, padding: S.lg }}>
                  <T kind="label">{s.title}</T>
                  <T kind="small" muted>{s.detail}</T>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <Card style={{ gap: S.md }}>
          <Pressable onPress={() => setShowNote((v) => !v)} style={styles.noteHead}>
            <IconBubble name="document-text-outline" size={40} color={C.info} bg={C.infoSoft} />
            <View style={{ flex: 1 }}>
              <T kind="label">Your summary for an adviser</T>
              <T kind="small" muted>So you don’t have to tell your story again</T>
            </View>
            <Ionicons name={showNote ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
          </Pressable>
          {showNote ? (
            <>
              <View style={styles.note}>
                <T kind="small" selectable style={{ lineHeight: 21 }}>{d.caseNote}</T>
              </View>
              <Button
                title="Contact Citizens Advice"
                variant="secondary"
                icon="open-outline"
                onPress={() => Linking.openURL('https://www.citizensadvice.org.uk/')}
              />
            </>
          ) : null}
        </Card>

        <T kind="small" muted center>
          {d.aiGenerated ? 'Wording written with AI. Voucher amounts set by fixed rules.' : 'Decision made by fixed rules.'} This is general
          information, not legal advice.
        </T>
      </View>
    </Screen>
  );
}

function AmountRow({ icon, label, value, sub }: { icon: 'basket' | 'flash'; label: string; value: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <IconBubble name={icon} size={44} />
      <View style={{ flex: 1 }}>
        <T kind="label">{label}</T>
        <T kind="small" muted>{sub}</T>
      </View>
      <T kind="title" style={{ color: C.primary }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: S.sm },
  store: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.md,
  },
  storeDot: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bullet: { flexDirection: 'row', gap: S.sm },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  note: { backgroundColor: C.bg, borderRadius: R.sm, padding: S.lg },
});
