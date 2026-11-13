import { useAction, useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ClientHeader } from '@/components/client-chrome';
import { Banner, Button, IconBubble, IconButton, OptionRow, ProgressBar, Screen, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { Facts } from '@convex/lib/facts';
import { BENEFITS, COOKING, DIETARY, ENERGY, FOOD_AT_HOME, REASONS, type Option } from '@convex/lib/questions';

const MONEY: (Option & { pence: number })[] = [
  { id: 'm0', label: 'Nothing', pence: 0 },
  { id: 'm1', label: 'Less than £20', pence: 1000 },
  { id: 'm2', label: '£20 to £50', pence: 3500 },
  { id: 'm3', label: '£50 to £150', pence: 10000 },
  { id: 'm4', label: 'More than £150', pence: 20000 },
];
const METER: (Option & { pence: number })[] = [
  { id: 'c0', label: 'On emergency credit, or nothing left', pence: 0 },
  { id: 'c1', label: 'Less than £5', pence: 300 },
  { id: 'c2', label: '£5 to £10', pence: 750 },
  { id: 'c3', label: 'More than £10', pence: 2000 },
];
const YES_NO: Option[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];

type Step = {
  id: string;
  title: string;
  help?: string;
  when?: (f: Facts) => boolean;
  done: (f: Facts) => boolean;
};

const STEPS: Step[] = [
  { id: 'household', title: 'Who lives with you?', help: 'Count everyone you buy food for, including you.', done: (f) => f.adults !== undefined },
  { id: 'age', title: 'Are you aged 16 or over?', done: (f) => f.age16Plus !== undefined, when: (f) => f.age16Plus === undefined },
  { id: 'postcode', title: 'What’s the first part of your postcode?', help: 'For example LS9. We only keep this part.', done: (f) => !!f.postcodeDistrict },
  { id: 'reasons', title: 'What’s making things hard right now?', help: 'Choose all that apply.', done: (f) => !!f.reasons?.length },
  { id: 'decisionDate', title: 'What date is on your benefits decision letter?', help: 'This tells us your deadline to challenge it.', when: (f) => !!f.reasons?.includes('benefit_change'), done: () => true },
  { id: 'benefits', title: 'Do you get, or have you applied for, any of these?', help: 'Choose all that apply.', done: (f) => !!f.benefits?.length },
  { id: 'money', title: 'How much money do you have until your next payment?', help: 'A rough guess is fine.', done: (f) => f.moneyAvailablePence !== undefined },
  { id: 'food', title: 'How much food do you have at home?', done: (f) => !!f.foodAtHome },
  { id: 'energy', title: 'How are you doing with gas and electricity?', done: (f) => !!f.energy },
  { id: 'meter', title: 'How much credit is on your meter?', when: (f) => f.energy === 'cant_top_up' || f.hasPrepaymentMeter === true, done: (f) => f.meterCreditPence !== undefined },
  { id: 'crisis', title: 'Have you had a Leeds Crisis Payment in the last 12 months?', done: (f) => f.crisisPaymentLast12Months !== undefined },
  { id: 'dietary', title: 'Any food needs we should know about?', done: (f) => !!f.dietary?.length },
  { id: 'cooking', title: 'How can you cook at the moment?', help: 'This helps the food bank pack the right food.', done: (f) => !!f.cooking },
];

export default function Steps() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');
  const setFacts = useMutation(api.cases.setFacts);
  const assess = useAction(api.intake.assess);

  const [local, setLocal] = useState<Facts | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState({ d: '', m: '', y: '' });
  const [fade] = useState(() => new Animated.Value(1));
  // Local edits on top of what the case already knows.
  const facts: Facts | null = local ?? (c ? { adults: 1, children: 0, ...c.facts } : null);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [index, fade]);

  if (!clientToken) return <Redirect href="/start" />;
  if (c === undefined || !facts) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} size="large" /></View>
      </Screen>
    );
  }
  if (c.status !== 'draft') return <Redirect href={`/track/${caseId}`} />;

  const steps = STEPS.filter((s) => (s.when ? s.when(facts) : true));
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const set = (patch: Partial<Facts>) => setLocal((f) => ({ ...(f ?? facts), ...patch }));
  const toggle = (key: 'reasons' | 'benefits' | 'dietary', id: string, exclusive?: string) => {
    const list = facts[key] ?? [];
    let next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (exclusive && !list.includes(id)) next = id === exclusive ? [id] : next.filter((x) => x !== exclusive);
    set({ [key]: next });
  };

  async function next() {
    setError(null);
    let f = facts!;
    if (step.id === 'decisionDate' && date.d && date.m && date.y.length === 4) {
      const iso = `${date.y}-${date.m.padStart(2, '0')}-${date.d.padStart(2, '0')}`;
      if (Number.isNaN(Date.parse(iso))) return setError('Please enter a real date, or leave it blank.');
      f = { ...f, benefitDecisionDate: iso, benefitDecisionType: f.benefitDecisionType ?? 'sanction' };
      setLocal(f);
    }
    if (step.id === 'energy' && f.energy === 'cant_top_up') f = { ...f, hasPrepaymentMeter: true };
    if (!last) return setIndex(index + 1);
    setBusy(true);
    try {
      await setFacts({ token, caseId, facts: f });
      await assess({ token, caseId });
      router.replace(`/result/${caseId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const single = (opts: Option[], value: string | undefined, onPick: (id: string) => void) => (
    <View style={{ gap: S.sm + 2 }}>
      {opts.map((o) => (
        <OptionRow
          key={o.id}
          label={o.label}
          hint={o.hint}
          selected={value === o.id}
          onPress={() => {
            onPick(o.id);
            if (!last) setTimeout(() => setIndex((i) => (i === index ? i + 1 : i)), 240);
          }}
        />
      ))}
    </View>
  );
  const multi = (key: 'reasons' | 'benefits' | 'dietary', opts: Option[], exclusive?: string) => (
    <View style={{ gap: S.sm + 2 }}>
      {opts.map((o) => (
        <OptionRow key={o.id} multi label={o.label} selected={!!facts[key]?.includes(o.id)} onPress={() => toggle(key, o.id, exclusive)} />
      ))}
    </View>
  );

  if (busy) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <View style={styles.ring}><ActivityIndicator size="large" color={C.primary} /></View>
          <T kind="heading" center>Checking what you can get…</T>
          <T muted center>Running the rules and preparing your summary.</T>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={
          <View style={{ gap: S.sm }}>
            <ClientHeader title="Step by step" onBack={() => (index === 0 ? (router.canGoBack() ? router.back() : router.replace('/start')) : setIndex(index - 1))} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <ProgressBar value={(index + 1) / steps.length} />
              <T kind="small" muted>{index + 1}/{steps.length}</T>
            </View>
          </View>
        }
        footer={<Button title={last ? 'Check what I can get' : 'Next'} icon="arrow-forward" onPress={next} disabled={!step.done(facts)} />}>
        <Animated.View style={{ opacity: fade, gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <T kind="title">{step.title}</T>
            {step.help ? <T muted>{step.help}</T> : null}
          </View>

          {step.id === 'household' ? (
            <View style={{ gap: S.md }}>
              <Counter icon="person" label="Adults" sub="16 and over" value={facts.adults ?? 1} min={1} onChange={(n) => set({ adults: n })} />
              <Counter icon="happy" label="Children" sub="Under 16" value={facts.children ?? 0} min={0} onChange={(n) => set({ children: n })} />
            </View>
          ) : null}
          {step.id === 'age' ? single(YES_NO, facts.age16Plus === undefined ? undefined : facts.age16Plus ? 'yes' : 'no', (id) => set({ age16Plus: id === 'yes' })) : null}
          {step.id === 'postcode' ? (
            <TextInput
              value={facts.postcodeDistrict ?? ''}
              onChangeText={(t) => {
                const d = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
                const m = /^LS(\d{1,2})$/.exec(d);
                set({ postcodeDistrict: d || undefined, leedsResident: m ? Number(m[1]) >= 1 && Number(m[1]) <= 29 : undefined });
              }}
              placeholder="LS9"
              placeholderTextColor={C.faint}
              autoCapitalize="characters"
              style={[styles.input, { width: 160 }]}
            />
          ) : null}
          {step.id === 'reasons' ? multi('reasons', REASONS) : null}
          {step.id === 'decisionDate' ? (
            <View style={{ flexDirection: 'row', gap: S.md }}>
              {(['d', 'm', 'y'] as const).map((k) => (
                <View key={k} style={{ gap: 4, flex: k === 'y' ? 1.6 : 1 }}>
                  <T kind="small" muted>{k === 'd' ? 'Day' : k === 'm' ? 'Month' : 'Year'}</T>
                  <TextInput
                    value={date[k]}
                    onChangeText={(t) => setDate((d) => ({ ...d, [k]: t.replace(/\D/g, '').slice(0, k === 'y' ? 4 : 2) }))}
                    keyboardType="number-pad"
                    style={[styles.input, { textAlign: 'center' }]}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {step.id === 'benefits' ? multi('benefits', BENEFITS, 'none') : null}
          {step.id === 'money'
            ? single(MONEY, MONEY.find((m) => m.pence === facts.moneyAvailablePence)?.id, (id) => set({ moneyAvailablePence: MONEY.find((m) => m.id === id)!.pence }))
            : null}
          {step.id === 'food' ? single(FOOD_AT_HOME, facts.foodAtHome, (id) => set({ foodAtHome: id })) : null}
          {step.id === 'energy' ? single(ENERGY, facts.energy, (id) => set({ energy: id, hasPrepaymentMeter: id === 'cant_top_up' ? true : facts.hasPrepaymentMeter })) : null}
          {step.id === 'meter'
            ? single(METER, METER.find((m) => m.pence === facts.meterCreditPence)?.id, (id) => set({ meterCreditPence: METER.find((m) => m.id === id)!.pence }))
            : null}
          {step.id === 'crisis'
            ? single(YES_NO, facts.crisisPaymentLast12Months === undefined ? undefined : facts.crisisPaymentLast12Months ? 'yes' : 'no', (id) =>
                set({ crisisPaymentLast12Months: id === 'yes' }),
              )
            : null}
          {step.id === 'dietary' ? multi('dietary', DIETARY, 'none') : null}
          {step.id === 'cooking' ? single(COOKING, facts.cooking, (id) => set({ cooking: id })) : null}

          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Counter({ icon, label, sub, value, min, onChange }: { icon: IconName; label: string; sub: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.counter}>
      <IconBubble name={icon} size={44} />
      <View style={{ flex: 1 }}>
        <T kind="label">{label}</T>
        <T kind="small" muted>{sub}</T>
      </View>
      <View style={styles.counterControls}>
        <IconButton name="remove" label={`Fewer ${label.toLowerCase()}`} onPress={() => onChange(Math.max(min, value - 1))} />
        <T kind="heading" style={{ minWidth: 28, textAlign: 'center' }}>{value}</T>
        <IconButton name="add" label={`More ${label.toLowerCase()}`} onPress={() => onChange(Math.min(12, value + 1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, paddingHorizontal: S.lg, height: 54, fontSize: 18, color: C.text },
  counter: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, padding: S.md, paddingLeft: S.lg },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: C.bg, borderRadius: R.pill, padding: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, paddingBottom: 80 },
  ring: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.md },
});
