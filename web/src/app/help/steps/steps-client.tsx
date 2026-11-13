'use client';

import { useAction, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ExitButton, caseHref } from '@/components/cc';
import { Container, useIdParam } from '@/components/page';
import { Banner, Button, Input, Option, Progress, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { Facts } from '@convex/lib/facts';
import { BENEFITS, COOKING, DIETARY, ENERGY, FOOD_AT_HOME, REASONS, type Option as Opt } from '@convex/lib/questions';

const MONEY: (Opt & { pence: number })[] = [
  { id: 'm0', label: 'Nothing', pence: 0 },
  { id: 'm1', label: 'Less than £20', pence: 1000 },
  { id: 'm2', label: '£20 to £50', pence: 3500 },
  { id: 'm3', label: '£50 to £150', pence: 10000 },
  { id: 'm4', label: 'More than £150', pence: 20000 },
];
const METER: (Opt & { pence: number })[] = [
  { id: 'c0', label: 'On emergency credit, or nothing left', pence: 0 },
  { id: 'c1', label: 'Less than £5', pence: 300 },
  { id: 'c2', label: '£5 to £10', pence: 750 },
  { id: 'c3', label: 'More than £10', pence: 2000 },
];
const YES_NO: Opt[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];

type Step = { id: string; title: string; help?: string; when?: (f: Facts) => boolean; done: (f: Facts) => boolean };

const STEPS: Step[] = [
  { id: 'household', title: 'Who lives with you?', help: 'Count everyone you buy food for, including you.', done: (f) => f.adults !== undefined },
  { id: 'age', title: 'Are you aged 16 or over?', done: (f) => f.age16Plus !== undefined, when: (f) => f.age16Plus === undefined },
  { id: 'postcode', title: 'What’s the first part of your postcode?', help: 'For example LS9. We only keep this part.', done: (f) => !!f.postcodeDistrict },
  { id: 'reasons', title: 'What’s making things hard right now?', help: 'Choose all that apply.', done: (f) => !!f.reasons?.length },
  { id: 'decisionDate', title: 'What date is on your benefits decision letter?', help: 'This tells us your deadline to challenge it. Leave blank if you don’t know.', when: (f) => !!f.reasons?.includes('benefit_change'), done: () => true },
  { id: 'benefits', title: 'Do you get, or have you applied for, any of these?', help: 'Choose all that apply.', done: (f) => !!f.benefits?.length },
  { id: 'money', title: 'How much money do you have until your next payment?', help: 'A rough guess is fine.', done: (f) => f.moneyAvailablePence !== undefined },
  { id: 'food', title: 'How much food do you have at home?', done: (f) => !!f.foodAtHome },
  { id: 'energy', title: 'How are you doing with gas and electricity?', done: (f) => !!f.energy },
  { id: 'meter', title: 'How much credit is on your meter?', when: (f) => f.energy === 'cant_top_up' || f.hasPrepaymentMeter === true, done: (f) => f.meterCreditPence !== undefined },
  { id: 'crisis', title: 'Have you had a Leeds Crisis Payment in the last 12 months?', done: (f) => f.crisisPaymentLast12Months !== undefined },
  { id: 'dietary', title: 'Any food needs we should know about?', done: (f) => !!f.dietary?.length },
  { id: 'cooking', title: 'How can you cook at the moment?', help: 'This helps the food bank pack the right food.', done: (f) => !!f.cooking },
];

export default function StepsClient() {
  const caseId = useIdParam<Id<'cases'>>();
  const token = useToken('client');
  const c = useQuery(api.cases.get, token && caseId ? { token, caseId } : 'skip');
  const setFacts = useMutation(api.cases.setFacts);
  const assess = useAction(api.intake.assess);
  const router = useRouter();

  const [local, setLocal] = useState<Facts | null>(null);
  const [index, setIndex] = useState(0);
  const [date, setDate] = useState({ d: '', m: '', y: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) router.replace('/help/');
    else if (c && c.status !== 'draft') router.replace(caseHref(c._id));
  }, [token, c, router]);

  if (!token || !c) return <Spinner />;
  if (busy) return <Spinner label="Checking what you can get… running the rules and preparing your summary." />;

  const facts: Facts = local ?? { adults: 1, children: 0, ...c.facts };
  const steps = STEPS.filter((s) => (s.when ? s.when(facts) : true));
  const i = Math.min(index, steps.length - 1);
  const step = steps[i];
  const last = i >= steps.length - 1;
  const set = (patch: Partial<Facts>) => setLocal({ ...facts, ...patch });
  const toggle = (key: 'reasons' | 'benefits' | 'dietary', id: string, exclusive?: string) => {
    const list = facts[key] ?? [];
    let next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (exclusive && !list.includes(id)) next = id === exclusive ? [id] : next.filter((x) => x !== exclusive);
    set({ [key]: next });
  };

  async function next() {
    setError(null);
    let f = facts;
    if (step.id === 'decisionDate' && date.d && date.m && date.y.length === 4) {
      const iso = `${date.y}-${date.m.padStart(2, '0')}-${date.d.padStart(2, '0')}`;
      if (Number.isNaN(Date.parse(iso))) return setError('Please enter a real date, or leave it blank.');
      f = { ...f, benefitDecisionDate: iso, benefitDecisionType: f.benefitDecisionType ?? 'sanction' };
      setLocal(f);
    }
    if (!last) return setIndex(i + 1);
    setBusy(true);
    try {
      await setFacts({ token: token!, caseId, facts: f });
      await assess({ token: token!, caseId });
      router.replace(caseHref(caseId));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const single = (opts: Opt[], value: string | undefined, pick: (id: string) => void) => (
    <div className="space-y-2.5">
      {opts.map((o) => (
        <Option
          key={o.id}
          label={o.label}
          hint={o.hint}
          selected={value === o.id}
          onClick={() => {
            pick(o.id);
            if (!last) setTimeout(() => setIndex((x) => (x === i ? x + 1 : x)), 220);
          }}
        />
      ))}
    </div>
  );
  const multi = (key: 'reasons' | 'benefits' | 'dietary', opts: Opt[], exclusive?: string) => (
    <div className="space-y-2.5">
      {opts.map((o) => (
        <Option key={o.id} multi label={o.label} selected={!!facts[key]?.includes(o.id)} onClick={() => toggle(key, o.id, exclusive)} />
      ))}
    </div>
  );

  return (
    <Container narrow>
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => (i === 0 ? router.back() : setIndex(i - 1))} className="rounded-full p-2 hover:bg-surface" aria-label="Back">
          <ArrowLeft className="size-5" />
        </button>
        <Progress value={(i + 1) / steps.length} className="flex-1" />
        <span className="text-sm text-muted">{i + 1}/{steps.length}</span>
        <ExitButton />
      </div>

      <div key={step.id} className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-normal tracking-tight">{step.title}</h1>
          {step.help ? <p className="text-muted">{step.help}</p> : null}
        </div>

        {step.id === 'household' ? (
          <div className="space-y-3">
            <Counter label="Adults" sub="16 and over" value={facts.adults ?? 1} min={1} onChange={(n) => set({ adults: n })} />
            <Counter label="Children" sub="Under 16" value={facts.children ?? 0} min={0} onChange={(n) => set({ children: n })} />
          </div>
        ) : null}
        {step.id === 'age' ? single(YES_NO, facts.age16Plus === undefined ? undefined : facts.age16Plus ? 'yes' : 'no', (id) => set({ age16Plus: id === 'yes' })) : null}
        {step.id === 'postcode' ? (
          <Input
            className="max-w-40 text-lg font-medium uppercase"
            value={facts.postcodeDistrict ?? ''}
            placeholder="LS9"
            onChange={(e) => {
              const d = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
              const m = /^LS(\d{1,2})$/.exec(d);
              set({ postcodeDistrict: d || undefined, leedsResident: m ? Number(m[1]) >= 1 && Number(m[1]) <= 29 : undefined });
            }}
          />
        ) : null}
        {step.id === 'reasons' ? multi('reasons', REASONS) : null}
        {step.id === 'decisionDate' ? (
          <div className="flex gap-3">
            {(['d', 'm', 'y'] as const).map((k) => (
              <label key={k} className="space-y-1">
                <span className="text-sm text-muted">{k === 'd' ? 'Day' : k === 'm' ? 'Month' : 'Year'}</span>
                <Input
                  inputMode="numeric"
                  className={k === 'y' ? 'w-28 text-center' : 'w-20 text-center'}
                  value={date[k]}
                  onChange={(e) => setDate({ ...date, [k]: e.target.value.replace(/\D/g, '').slice(0, k === 'y' ? 4 : 2) })}
                />
              </label>
            ))}
          </div>
        ) : null}
        {step.id === 'benefits' ? multi('benefits', BENEFITS, 'none') : null}
        {step.id === 'money' ? single(MONEY, MONEY.find((m) => m.pence === facts.moneyAvailablePence)?.id, (id) => set({ moneyAvailablePence: MONEY.find((m) => m.id === id)!.pence })) : null}
        {step.id === 'food' ? single(FOOD_AT_HOME, facts.foodAtHome, (id) => set({ foodAtHome: id })) : null}
        {step.id === 'energy' ? single(ENERGY, facts.energy, (id) => set({ energy: id, hasPrepaymentMeter: id === 'cant_top_up' ? true : facts.hasPrepaymentMeter })) : null}
        {step.id === 'meter' ? single(METER, METER.find((m) => m.pence === facts.meterCreditPence)?.id, (id) => set({ meterCreditPence: METER.find((m) => m.id === id)!.pence })) : null}
        {step.id === 'crisis'
          ? single(YES_NO, facts.crisisPaymentLast12Months === undefined ? undefined : facts.crisisPaymentLast12Months ? 'yes' : 'no', (id) => set({ crisisPaymentLast12Months: id === 'yes' }))
          : null}
        {step.id === 'dietary' ? multi('dietary', DIETARY, 'none') : null}
        {step.id === 'cooking' ? single(COOKING, facts.cooking, (id) => set({ cooking: id })) : null}

        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button size="lg" className="w-full" icon={ArrowRight} onClick={next} disabled={!step.done(facts)}>
          {last ? 'Check what I can get' : 'Next'}
        </Button>
      </div>
    </Container>
  );
}

function Counter({ label, sub, value, min, onChange }: { label: string; sub: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-bg p-1">
        <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="rounded-full p-2 hover:bg-line"><Minus className="size-4" /></button>
        <span className="w-8 text-center text-sm font-medium text-ink">{value}</span>
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(12, value + 1))} className="rounded-full p-2 hover:bg-line"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}
