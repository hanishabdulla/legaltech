import { Pressable, StyleSheet, View } from 'react-native';

import { Ionicons, T } from '@/components/ui';
import { C, R, RETAILER_COLORS, S } from '@/constants/theme';
import { daysLeft, money, shortDate, voucherStatus } from '@/lib/format';
import type { Doc } from '@convex/_generated/dataModel';

export function VoucherCard({ voucher, onPress, compact }: { voucher: Doc<'vouchers'>; onPress?: () => void; compact?: boolean }) {
  const status = voucherStatus(voucher);
  const color = status === 'active' ? (RETAILER_COLORS[voucher.retailer] ?? C.primary) : '#8D9792';
  const left = daysLeft(voucher.expiresAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${money(voucher.valuePence)} ${voucher.retailer} voucher, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: color }, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.circleA} />
      <View style={styles.circleB} />

      <View style={styles.row}>
        <View style={styles.kind}>
          <Ionicons name={voucher.kind === 'food' ? 'basket' : 'flash'} size={14} color="#fff" />
          <T kind="caption" style={{ color: '#fff' }}>{voucher.kind === 'food' ? 'Food voucher' : 'Energy top-up'}</T>
        </View>
        <StatusPill status={status} left={left} />
      </View>

      <View style={{ gap: 2 }}>
        <T kind="label" style={{ color: 'rgba(255,255,255,0.9)' }}>{voucher.retailer}</T>
        <T style={[styles.value, compact && { fontSize: 34, lineHeight: 40 }]}>{money(voucher.valuePence)}</T>
        <T kind="small" style={{ color: 'rgba(255,255,255,0.75)' }}>Illustrative amount</T>
      </View>

      <View style={styles.row}>
        <T kind="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {status === 'used' && voucher.usedAt
            ? `Used ${shortDate(voucher.usedAt)}`
            : status === 'expired'
              ? `Expired ${shortDate(voucher.expiresAt)}`
              : `Valid until ${shortDate(voucher.expiresAt)}`}
        </T>
        {onPress ? <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" /> : null}
      </View>
    </Pressable>
  );
}

export function StatusPill({ status, left }: { status: 'active' | 'used' | 'expired'; left: number }) {
  const label = status === 'active' ? (left <= 1 ? 'Expires today' : `${left} days left`) : status === 'used' ? 'Used' : 'Expired';
  const urgent = status === 'active' && left <= 5;
  return (
    <View style={[styles.pill, urgent && { backgroundColor: C.accent }]}>
      <T kind="small" style={{ color: urgent ? C.text : '#fff', fontWeight: '700' }}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.xl - 4, gap: S.lg, overflow: 'hidden', minHeight: 170 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  pill: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  circleA: { position: 'absolute', right: -50, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  circleB: { position: 'absolute', right: 30, bottom: -90, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
});
