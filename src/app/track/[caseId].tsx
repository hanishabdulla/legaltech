import { useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { OutcomePill, Timeline, type Outcome, type Step } from '@/components/case-bits';
import { AiBadge, ClientHeader, NotAdvice } from '@/components/client-chrome';
import { VoucherCard } from '@/components/voucher-card';
import { Banner, Button, Card, Screen, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const REFERRAL_STATUS: Record<string, string> = {
  pending: 'Waiting for an adviser',
  approved: 'Approved',
  sent: 'Approved and sent',
  rejected: 'Not approved',
};

export default function Track() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');

  if (!clientToken) return <Redirect href="/start" />;
  if (c === undefined) {
    return (
      <Screen header={<ClientHeader title="Your case" />}>
        <ActivityIndicator color={C.primary} style={{ marginTop: S.xxl }} />
      </Screen>
    );
  }
  if (c.status === 'draft') return <Redirect href={c.assessedAt ? `/result/${caseId}` : `/intake/${caseId}`} />;

  const decided = c.referrals.length > 0 && c.referrals.every((r) => r.status !== 'pending');
  const anyApproved = c.referrals.some((r) => r.status === 'approved' || r.status === 'sent');
  const reviewing = c.status === 'in_review' || decided;

  const steps: Step[] = [
    { label: 'Sent to an adviser', detail: c.submittedAt ? shortDate(c.submittedAt) : undefined, state: 'done' },
    { label: 'Adviser checking', detail: 'They check your answers and documents', state: reviewing ? 'done' : 'current' },
    {
      label: decided ? (anyApproved ? 'Approved' : 'Decision made') : 'Decision',
      detail: decided ? undefined : 'Usually the same day',
      state: decided ? 'done' : reviewing ? 'current' : 'todo',
    },
    {
      label: 'Referral sent',
      detail: anyApproved ? 'To the food bank, council or fuel partner' : undefined,
      state: anyApproved ? 'done' : 'todo',
    },
    {
      label: 'Ready to use',
      detail: c.vouchers.length ? 'Your vouchers are in your wallet' : undefined,
      state: c.vouchers.length ? 'done' : 'todo',
    },
  ];

  return (
    <Screen
      header={<ClientHeader title="Your case" onBack={() => router.replace('/start')} />}
      footer={c.vouchers.length ? <Button title="Open my wallet" icon="wallet-outline" onPress={() => router.push('/wallet')} /> : undefined}>
      <View style={{ gap: S.xl }}>
        {c.safeguardingFlag ? <Banner tone="danger" icon="heart" title="Your safety comes first">{c.safeguardingFlag}</Banner> : null}

        <View style={{ gap: S.sm }}>
          <T kind="title">{decided ? (anyApproved ? 'Your help is approved' : 'An adviser has looked at your case') : 'An adviser is on it'}</T>
          <T muted>{decided ? 'Here’s what was decided.' : 'You don’t need to explain everything again. Your summary has been sent with your case.'}</T>
        </View>

        {c.adviserMessage ? (
          <Banner tone="info" icon="chatbubble-ellipses-outline" title="Message from your adviser">{c.adviserMessage}</Banner>
        ) : null}

        <Card><Timeline steps={steps} /></Card>

        {c.referrals.length ? (
          <View style={{ gap: S.sm }}>
            <T kind="heading">Referrals</T>
            {c.referrals.map((r) => {
              const e = c.eligibility.find((x) => x.scheme === r.scheme);
              return (
                <Card key={r._id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.sm }}>
                    <T kind="label" style={{ flex: 1 }}>{r.info?.name ?? r.scheme}</T>
                    {e ? <OutcomePill outcome={e.outcome as Outcome} /> : null}
                  </View>
                  <T kind="small" style={{ color: r.status === 'rejected' ? C.danger : r.status === 'pending' ? C.muted : C.primary, fontWeight: '700' }}>
                    {REFERRAL_STATUS[r.status]}
                  </T>
                  {r.status === 'rejected' && r.reason ? <T kind="small" muted>Reason: {r.reason}</T> : null}
                  {r.status === 'sent' && r.scheme === 'leeds_crisis_payment' ? (
                    <T kind="small" muted>Your pre-filled application is ready. Leeds City Council makes the final decision.</T>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ) : null}

        {c.vouchers.length ? (
          <View style={{ gap: S.md }}>
            <AiBadge approved />
            {c.vouchers.map((v) => (
              <VoucherCard key={v._id} voucher={v} onPress={() => router.push(`/voucher/${v._id}`)} />
            ))}
          </View>
        ) : null}

        {c.actions.length ? <Button title="See your action plan" variant="secondary" icon="list-outline" onPress={() => router.push(`/plan/${caseId}`)} /> : null}
        <NotAdvice />
      </View>
    </Screen>
  );
}
