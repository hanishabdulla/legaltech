import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { VoucherCard } from '@/components/voucher-card';
import { Button, Card, IconBubble, IconButton, Screen, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { money, voucherStatus } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { api } from '@convex/_generated/api';

export default function Wallet() {
  const userId = useUserId();
  const vouchers = useQuery(api.vouchers.list, { userId });

  const active = (vouchers ?? []).filter((v) => voucherStatus(v) === 'active').sort((a, b) => a.expiresAt - b.expiresAt);
  const past = (vouchers ?? []).filter((v) => voucherStatus(v) !== 'active');
  const total = active.reduce((s, v) => s + v.valuePence, 0);

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
          <T kind="heading">Wallet</T>
        </View>
      }>
      <View style={{ gap: S.xl }}>
        <View style={{ gap: 2 }}>
          <T kind="caption">Available to spend</T>
          <T kind="display">{money(total)}</T>
          <T muted>
            {active.length ? `Across ${active.length} ${active.length === 1 ? 'voucher' : 'vouchers'}. Use the soonest to expire first.` : 'You have no active vouchers.'}
          </T>
        </View>

        {vouchers !== undefined && vouchers.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: S.xxl }}>
            <IconBubble name="wallet-outline" color={C.muted} bg={C.bg} size={56} />
            <T kind="label" center>Nothing here yet</T>
            <T kind="small" muted center>Answer a few questions to see if you can get a voucher.</T>
            <Button title="Check what I can get" onPress={() => router.push('/check')} style={{ alignSelf: 'stretch', marginTop: S.sm }} />
          </Card>
        ) : null}

        {active.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Active</T>
            {active.map((v) => (
              <VoucherCard key={v._id} voucher={v} onPress={() => router.push(`/voucher/${v._id}`)} />
            ))}
          </View>
        ) : null}

        {past.length ? (
          <View style={{ gap: S.md }}>
            <T kind="heading">Used and expired</T>
            {past.map((v) => (
              <VoucherCard key={v._id} voucher={v} compact onPress={() => router.push(`/voucher/${v._id}`)} />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
