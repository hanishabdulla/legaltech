import { useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FactChips, SchemeCard, type Outcome } from '@/components/case-bits';
import { AiBadge, ClientHeader, NotAdvice } from '@/components/client-chrome';
import { Banner, Button, Card, IconBubble, Ionicons, Screen, T } from '@/components/ui';
import { C, R, RETAILER_COLORS, S } from '@/constants/theme';
import { errorMessage, longDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const RETAILERS = ['Tesco', 'Asda', 'Sainsbury’s', 'Aldi', 'Lidl', 'Morrisons', 'Co-op'];

export default function Result() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');
  const submit = useMutation(api.cases.submit);
  const setRetailer = useMutation(api.cases.setRetailer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clientToken) return <Redirect href="/start" />;
  if (c === undefined) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  if (c.status !== 'draft') return <Redirect href={`/track/${caseId}`} />;
  if (!c.assessedAt) return <Redirect href={`/intake/${caseId}`} />;

  const worthSending = c.eligibility.filter((e) => e.outcome !== 'unlikely');
  const food = c.eligibility.find((e) => e.scheme === 'food_bank_referral' && e.outcome !== 'unlikely');
  const retailer = c.retailer ?? 'Tesco';
  const firstDeadline = c.actions.find((a) => a.deadline);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await submit({ token, caseId });
      router.replace(`/track/${caseId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<ClientHeader title="What you can get" onBack={() => router.replace('/start')} />}
      footer={
        <View style={{ gap: S.sm }}>
          {worthSending.length ? (
            <Button title="Send to an adviser" icon="paper-plane-outline" onPress={send} loading={busy} />
          ) : (
            <Button title="See your action plan" icon="list-outline" onPress={() => router.push(`/plan/${caseId}`)} />
          )}
          <Button title="Change my answers" variant="ghost" onPress={() => router.push(`/intake/${caseId}`)} />
        </View>
      }>
      <View style={{ gap: S.xl }}>
        {c.safeguardingFlag ? <Banner tone="danger" icon="heart" title="Your safety comes first">{c.safeguardingFlag}</Banner> : null}

        <View style={{ gap: S.md }}>
          <AiBadge />
          <T kind="title">{worthSending.length ? 'Here’s what you could get' : 'We couldn’t find a match this time'}</T>
          {c.clientSummary ? <T muted>{c.clientSummary}</T> : null}
        </View>

        <View style={{ gap: S.sm }}>
          <T kind="caption">Based on</T>
          <FactChips chips={c.chips} />
        </View>

        {c.eligibility.map((e) => (
          <SchemeCard
            key={e._id}
            name={e.info?.name ?? e.scheme}
            who={e.info?.who}
            contact={e.info?.contact}
            outcome={e.outcome as Outcome}
            explanation={e.explanation}
            toFinish={e.toFinish}
            trace={e.trace}
            note={
              e.scheme === 'leeds_crisis_payment'
                ? 'Leeds City Council says it refuses about 80% of applications because the criteria aren’t met. This check is to help you apply only when it’s worth it. The council makes the decision.'
                : undefined
            }
          />
        ))}

        {food ? (
          <View style={{ gap: S.md }}>
            <View style={{ gap: 2 }}>
              <T kind="heading">If food help is approved, where would you like to shop?</T>
              <T kind="small" muted>Demo: an approved referral shows as a supermarket e-voucher in your wallet.</T>
            </View>
            <View style={{ gap: S.sm }}>
              {RETAILERS.map((r) => {
                const on = r === retailer;
                const color = RETAILER_COLORS[r];
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setRetailer({ token, caseId, retailer: r })}
                    style={[styles.store, on && { borderColor: color, backgroundColor: `${color}12` }]}>
                    <View style={[styles.storeDot, { backgroundColor: color }]}>
                      <T kind="label" style={{ color: '#fff' }}>{r[0]}</T>
                    </View>
                    <T kind="label" style={{ flex: 1 }}>{r}</T>
                    {on ? <Ionicons name="checkmark-circle" size={22} color={color} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {c.actions.length ? (
          <Card onPress={() => router.push(`/plan/${caseId}`)} style={styles.planCard}>
            <IconBubble name="list" size={44} color={C.warn} bg={C.warnSoft} />
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="label">Your action plan</T>
              <T kind="small" muted>
                {firstDeadline?.deadline
                  ? `${firstDeadline.title}: by ${longDate(firstDeadline.deadline)}`
                  : `${c.actions.length} thing${c.actions.length === 1 ? '' : 's'} to sort out the cause`}
              </T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Card>
        ) : null}

        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
        <NotAdvice />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  store: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, padding: S.md },
  storeDot: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: S.md },
});
