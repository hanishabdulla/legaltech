import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Field } from '@/components/remedy';
import { Banner, Button, IconBubble, IconButton, OptionRow, Screen, T } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

/** Demo sign-in for Remedy lawyers and partner-firm users (code REMEDY). The pilot uses Convex Auth. */
export function RemedyStaffSignIn({ role, onToken }: { role: 'lawyer' | 'firm'; onToken: (t: string) => void }) {
  const signIn = useMutation(api.sessions.remedyStaffSignIn);
  const panel = useQuery(api.firms.panel, role === 'firm' ? {} : 'skip');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [firmId, setFirmId] = useState<Id<'partnerFirms'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      onToken(await signIn({ name, code, role, firmId: firmId ?? undefined }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const lawyer = role === 'lawyer';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={<IconButton name="arrow-back" label="Back" onPress={() => router.replace('/business')} />}
        footer={<Button title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} disabled={!name.trim() || !code.trim() || (!lawyer && !firmId)} />}>
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.md }}>
            <IconBubble name={lawyer ? 'scale' : 'business'} size={52} color="#fff" bg={C.remedy} />
            <T kind="display">{lawyer ? 'Remedy lawyer' : 'Partner firm'}</T>
            <T muted>
              {lawyer
                ? 'Review flagged matters, edit and approve AI drafts, ask clients for information and recommend partner firms.'
                : 'See the handoff packs Remedy clients chose to send to your firm, and accept or decline them.'}
            </T>
          </View>
          <Field label="Your name" value={name} onChangeText={setName} placeholder={lawyer ? 'e.g. A. Lawyer' : 'e.g. Sam Patel'} />
          {!lawyer ? (
            <View style={{ gap: S.sm }}>
              <T kind="label">Your firm</T>
              {panel?.length === 0 ? <Banner tone="warn" icon="alert-circle">No panel firms yet. Run `npx convex run seed:run`.</Banner> : null}
              {panel?.map((f) => <OptionRow key={f._id} label={f.name} hint={`${f.city} · ${f.licence}`} selected={firmId === f._id} onPress={() => setFirmId(f._id)} />)}
            </View>
          ) : null}
          <Field label="Access code" value={code} onChangeText={setCode} placeholder="Demo code: REMEDY" autoCapitalize="characters" />
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          <Banner tone="info" icon="information-circle">Demo sign-in. The pilot uses proper staff accounts with roles (Convex Auth).</Banner>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
