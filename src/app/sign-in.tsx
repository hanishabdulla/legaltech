import { useMutation } from 'convex/react';
import { Redirect, router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, IconBubble, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

type InputRef = ComponentRef<typeof TextInput>;

/** Formats as you type: QQ 12 34 56 C */
function formatNi(raw: string) {
  const s = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 9);
  return [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6), s.slice(6, 8), s.slice(8, 9)].filter(Boolean).join(' ');
}

export default function SignIn() {
  const { userId, setUser } = useSession();
  const signIn = useMutation(api.users.signIn);

  const [firstName, setFirstName] = useState('');
  const [ni, setNi] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const niRef = useRef<InputRef>(null);
  const dayRef = useRef<InputRef>(null);
  const monthRef = useRef<InputRef>(null);
  const yearRef = useRef<InputRef>(null);

  if (userId) return <Redirect href="/home" />;

  const niComplete = ni.replace(/\s/g, '').length === 9;
  const canSubmit = firstName.trim() && niComplete && day && month && year.length === 4;

  async function submit() {
    setError(null);
    const d = Number(day), m = Number(month), y = Number(year);
    const date = new Date(Date.UTC(y, m - 1, d));
    const valid = date.getUTCDate() === d && date.getUTCMonth() === m - 1 && y > 1900 && date.getTime() < Date.now();
    if (!valid) return setError('Please enter a real date of birth.');
    setBusy(true);
    try {
      const id = await signIn({
        firstName,
        niNumber: ni,
        dateOfBirth: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
      await setUser(id);
      router.replace('/home');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={<Button title="Continue" icon="arrow-forward" onPress={submit} loading={busy} disabled={!canSubmit} />}>
        <View style={{ gap: S.xl, paddingTop: S.xl }}>
          <View style={{ gap: S.lg }}>
            <IconBubble name="leaf" size={56} />
            <View style={{ gap: S.sm }}>
              <T kind="display">Common Counsel</T>
              <T muted>Help with food and energy, when you need it. Sign in with your National Insurance number.</T>
            </View>
          </View>

          <Field label="First name">
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Maya"
              placeholderTextColor={C.faint}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => niRef.current?.focus()}
              style={styles.input}
            />
          </Field>

          <Field label="National Insurance number" hint="It’s on your payslip, P60 or letters about benefits.">
            <TextInput
              ref={niRef}
              value={ni}
              onChangeText={(t) => setNi(formatNi(t))}
              placeholder="QQ 12 34 56 C"
              placeholderTextColor={C.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={13}
              returnKeyType="next"
              onSubmitEditing={() => dayRef.current?.focus()}
              style={[styles.input, styles.mono]}
            />
          </Field>

          <Field label="Date of birth" hint="For example, 27 3 1990">
            <View style={{ flexDirection: 'row', gap: S.md }}>
              <DatePart label="Day" ref_={dayRef} value={day} max={2} onChange={(t) => { setDay(t); if (t.length === 2) monthRef.current?.focus(); }} />
              <DatePart label="Month" ref_={monthRef} value={month} max={2} onChange={(t) => { setMonth(t); if (t.length === 2) yearRef.current?.focus(); }} />
              <DatePart label="Year" ref_={yearRef} value={year} max={4} wide onChange={setYear} />
            </View>
          </Field>

          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

          <Banner tone="info" icon="information-circle" title="This is a demo">
            No real identity check happens. Try QQ 12 34 56 C with any date of birth.
          </Banner>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: S.sm }}>
      <View style={{ gap: 2 }}>
        <T kind="label">{label}</T>
        {hint ? <T kind="small" muted>{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

function DatePart({ label, value, onChange, max, wide, ref_ }: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  max: number;
  wide?: boolean;
  ref_: React.RefObject<InputRef | null>;
}) {
  return (
    <View style={{ gap: 4, flex: wide ? 1.6 : 1 }}>
      <T kind="small" muted>{label}</T>
      <TextInput
        ref={ref_}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, max))}
        keyboardType="number-pad"
        maxLength={max}
        style={[styles.input, { textAlign: 'center' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    height: 54,
    fontSize: 18,
    color: C.text,
  },
  mono: { letterSpacing: 1.5, fontWeight: '600' },
});
