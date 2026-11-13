import { useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { StatusPill } from '@/components/voucher-card';
import { Banner, Button, Card, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, R, RETAILER_COLORS, S } from '@/constants/theme';
import { daysLeft, groupCode, longDate, money, voucherStatus } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export default function VoucherDetail() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const userId = useUserId();
  const voucher = useQuery(api.vouchers.get, { userId, voucherId: id as Id<'vouchers'> });
  const setUsed = useMutation(api.vouchers.setUsed);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/wallet'))} />
      <T kind="heading">Voucher</T>
    </View>
  );

  if (voucher === undefined) {
    return (
      <Screen header={header} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </Screen>
    );
  }
  if (voucher === null) {
    return (
      <Screen header={header}>
        <Banner tone="warn" icon="alert-circle">We couldn’t find this voucher.</Banner>
      </Screen>
    );
  }

  const status = voucherStatus(voucher);
  const color = status === 'active' ? (RETAILER_COLORS[voucher.retailer] ?? C.primary) : '#8D9792';
  const isFood = voucher.kind === 'food';

  async function toggleUsed() {
    setBusy(true);
    await setUsed({ userId, voucherId: voucher!._id, used: status !== 'used' }).finally(() => setBusy(false));
  }

  return (
    <Screen
      header={header}
      footer={
        status === 'expired' ? null : (
          <Button
            title={status === 'used' ? 'Mark as not used' : 'I’ve used this voucher'}
            variant={status === 'used' ? 'ghost' : 'secondary'}
            icon={status === 'used' ? 'arrow-undo-outline' : 'checkmark-done-outline'}
            onPress={toggleUsed}
            loading={busy}
          />
        )
      }>
      <View style={{ gap: S.xl }}>
        {fresh ? (
          <Banner tone="success" icon="checkmark-circle" title="Your voucher is ready">
            It’s saved in your wallet. You can come back to it any time.
          </Banner>
        ) : null}

        <View style={[styles.ticket, { borderColor: color }]}>
          <View style={[styles.ticketTop, { backgroundColor: color }]}>
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={isFood ? 'basket' : 'flash'} size={16} color="#fff" />
                <T kind="caption" style={{ color: '#fff' }}>{isFood ? 'Food voucher' : 'Energy top-up'}</T>
              </View>
              <StatusPill status={status} left={daysLeft(voucher.expiresAt)} />
            </View>
            <T kind="label" style={{ color: 'rgba(255,255,255,0.9)' }}>{voucher.retailer}</T>
            <T style={styles.value}>{money(voucher.valuePence)}</T>
          </View>

          <View style={styles.perforation}>
            <View style={[styles.notch, { left: -12 }]} />
            <View style={styles.dash} />
            <View style={[styles.notch, { right: -12 }]} />
          </View>

          <View style={styles.ticketBottom}>
            <View style={[styles.qrWrap, status !== 'active' && { opacity: 0.25 }]}>
              <QRCode value={voucher.code} size={176} color={C.text} backgroundColor="#fff" />
            </View>
            <T kind="caption" center>Voucher code</T>
            <T selectable center style={styles.code}>{groupCode(voucher.code)}</T>
            <Pressable onPress={() => setShowPin((v) => !v)} style={styles.pinRow} hitSlop={8}>
              <T kind="small" muted>PIN</T>
              <T kind="label" style={{ letterSpacing: 4 }}>{showPin ? voucher.pin : '••••'}</T>
              <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
            </Pressable>
          </View>
        </View>

        <Card style={{ gap: 0, padding: 0 }}>
          <Detail label="Status" value={status === 'active' ? 'Ready to use' : status === 'used' ? 'Used' : 'Expired'} />
          <Detail label="Issued" value={longDate(voucher.issuedAt)} />
          <Detail label="Valid until" value={longDate(voucher.expiresAt)} strong={status === 'active'} />
          {voucher.usedAt ? <Detail label="Marked used" value={longDate(voucher.usedAt)} /> : null}
          <Detail label="Value" value={money(voucher.valuePence)} last />
        </Card>

        <View style={{ gap: S.md }}>
          <T kind="heading">How to use it</T>
          {(isFood
            ? [
                `Go to any ${voucher.retailer} store.`,
                'At the till, tell them you have an e-voucher and show this screen.',
                'They’ll scan the code. Turn your screen brightness up if it doesn’t scan.',
                'You can’t use it for alcohol, tobacco or lottery tickets.',
              ]
            : [
                'Take this code to any shop with a PayPoint or Payzone sign.',
                'Bring your prepayment key or card.',
                'The shop adds the credit, then top up your meter as usual.',
              ]
          ).map((line, i) => (
            <View key={line} style={styles.stepRow}>
              <View style={styles.stepNum}><T kind="small" style={{ color: C.primary, fontWeight: '700' }}>{i + 1}</T></View>
              <T style={{ flex: 1 }}>{line}</T>
            </View>
          ))}
        </View>

        <T kind="small" muted center>Demo voucher. It can’t be used in a real shop.</T>
      </View>
    </Screen>
  );
}

function Detail({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.detailBorder]}>
      <T muted>{label}</T>
      <T kind="label" style={strong && { color: C.primary }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { backgroundColor: C.surface, borderRadius: R.lg, overflow: 'hidden', borderWidth: 0 },
  ticketTop: { padding: S.xl - 4, gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 48, lineHeight: 54, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  perforation: { height: 24, justifyContent: 'center', backgroundColor: C.surface },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: C.bg, top: 0 },
  dash: { marginHorizontal: S.xl, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.border },
  ticketBottom: { alignItems: 'center', gap: S.sm, paddingHorizontal: S.xl, paddingBottom: S.xl },
  qrWrap: { padding: S.md, backgroundColor: '#fff', borderRadius: R.md, marginBottom: S.sm },
  code: { fontSize: 20, fontWeight: '700', letterSpacing: 1.5, color: C.text, fontVariant: ['tabular-nums'] },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bg, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.pill, marginTop: S.xs },
  detail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.md + 2 },
  detailBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  stepRow: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
