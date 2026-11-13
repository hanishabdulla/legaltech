import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Check, Field, RemedyHeader, SECTORS, STAGES, type Stage } from '@/components/remedy';
import { Banner, Button, Chip, OptionRow, Screen, T } from '@/components/ui';
import { S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

const PRIVACY = [
  'Remedy’s AI reads your question and the legislation, and drafts an answer. Rules, not the AI, decide what a lawyer must check. A named Remedy lawyer approves anything flagged before it counts as checked.',
  'Unchecked answers are general information about the law in England and Wales, not legal advice.',
  'Lawyer-checked answers are given by solicitors working outside a law firm under SRA rules. Some protections differ: for example there is no compulsory professional indemnity cover through Remedy, and what you tell us may not be covered by legal privilege.',
  'We only share anything with a partner law firm if you choose the firm and tick what to share. Remedy receives a referral fee, which is always shown.',
  'The AI never sees your business name or company number unless it needs them. You can delete your data at any time.',
];

export default function BusinessStart() {
  const { setBusinessToken } = useSession();
  const start = useMutation(api.business.start);
  const [name, setName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [sector, setSector] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState('');
  const [stage, setStage] = useState<Stage>('trading');
  const [region, setRegion] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fillDemo() {
    setName('Jade Studio Ltd');
    setCompanyNumber('');
    setSector('creative');
    setHeadcount('3');
    setStage('trading');
  }

  async function submit() {
    setError(null);
    if (!region) return setError('Remedy only covers businesses in England and Wales for now.');
    if (!sector) return setError('Please choose a sector.');
    setBusy(true);
    try {
      const token = await start({
        name,
        companyNumber: companyNumber.trim() || undefined,
        sector,
        headcount: Number(headcount) || 0,
        stage,
        region: 'england_wales',
        consent,
      });
      await setBusinessToken(token);
      router.replace('/business');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={<RemedyHeader title="Remedy" subtitle="Legal answers for small businesses" right={<Button title="Demo" variant="ghost" onPress={fillDemo} style={{ minHeight: 40, paddingHorizontal: S.md }} />} />}
        footer={<Button title="Set up my business" icon="arrow-forward" onPress={submit} loading={busy} disabled={!name.trim() || !consent} />}>
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <T kind="display">Tell us about your business</T>
            <T muted>So we can answer with the right law. Takes a minute.</T>
          </View>
          <Field label="Business name" value={name} onChangeText={setName} placeholder="e.g. Jade Studio Ltd" />
          <Field label="Company number (optional)" value={companyNumber} onChangeText={setCompanyNumber} placeholder="8 characters, e.g. 12345678" autoCapitalize="characters" />
          <View style={{ gap: S.sm }}>
            <T kind="label">Sector</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {SECTORS.map((s) => <Chip key={s.id} label={s.label} selected={sector === s.id} onPress={() => setSector(s.id)} />)}
            </View>
          </View>
          <Field label="How many people work in the business?" value={headcount} onChangeText={(t) => setHeadcount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Including you" />
          <View style={{ gap: S.sm }}>
            <T kind="label">Stage</T>
            {STAGES.map((s) => <OptionRow key={s.id} label={s.label} hint={s.hint} selected={stage === s.id} onPress={() => setStage(s.id)} />)}
          </View>
          <View style={{ gap: S.sm }}>
            <T kind="label">Where is the business?</T>
            <Check label="England or Wales" hint="Remedy doesn’t cover Scottish or Northern Irish law yet." checked={region} onPress={() => setRegion(!region)} />
          </View>
          <View style={{ gap: S.sm }}>
            <T kind="heading">How Remedy works</T>
            {PRIVACY.map((p) => <T key={p} kind="small" muted>• {p}</T>)}
            <Check label="I’ve read this and agree to Remedy storing my business details and questions." checked={consent} onPress={() => setConsent(!consent)} />
          </View>
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          <Banner tone="info" icon="information-circle">Prototype with demo data only. No real legal advice, referrals or firms.</Banner>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
