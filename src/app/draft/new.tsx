import { useAction, useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, IconBubble, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { draftHref, useOwnerToken, type DraftOwner } from '@/lib/drafting';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

/** Pick a document, or describe one, then start the drafting chat. */
export default function NewDraft() {
  const params = useLocalSearchParams<{ kind?: string; caseId?: string; template?: string; text?: string }>();
  const kind: DraftOwner = params.kind === 'business' ? 'business' : 'client';
  const caseId = (params.caseId || undefined) as Id<'cases'> | undefined;
  const token = useOwnerToken(kind);
  const { setClientToken } = useSession();
  const templates = useQuery(api.drafting.templates, { kind });
  const start = useAction(api.drafting.start);
  const startClient = useMutation(api.sessions.startClient);

  const [text, setText] = useState(params.text ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'warn' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auto = useRef(false);
  const remedy = kind === 'business';
  const accent = remedy ? C.remedy : C.primary;

  async function go(opts: { templateId?: string; text?: string }) {
    setError(null);
    setNotice(null);
    let t = token;
    if (!t) {
      if (remedy) return router.replace('/business');
      if (!consent) return setError('Please tick the box to agree to how we use your information.');
      t = await startClient({ language: 'en' });
      await setClientToken(t);
    }
    setBusy(opts.templateId ?? 'text');
    try {
      const res = await start({ kind, token: t, templateId: opts.templateId, text: opts.text, caseId });
      if (res.status === 'started') {
        router.replace(draftHref(kind, res.draftId));
        return;
      }
      setNotice({ tone: res.status === 'unsupported' ? 'warn' : 'info', text: res.message });
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(null);
  }

  useEffect(() => {
    if (params.template && token && !auto.current) {
      auto.current = true;
      queueMicrotask(() => go({ templateId: params.template }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.template, token]);

  if (params.template && token && busy !== null) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
          <ActivityIndicator color={accent} size="large" />
          <T muted>Starting your document…</T>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(remedy ? '/business' : '/start'))} />}>
        <View style={{ gap: S.xl }}>
          <View style={{ gap: S.md }}>
            <IconBubble name="document-text" size={52} color="#fff" bg={accent} />
            <T kind="display">{remedy ? 'Draft a document' : 'Write a letter'}</T>
            <T muted>Tell me what you need, or pick one below. I’ll ask a few questions and make a PDF you can open, share and re-create.</T>
          </View>

          <View style={{ gap: S.sm }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={remedy ? 'e.g. An NDA before we share designs with a printer' : 'e.g. A letter to my landlord about damp and a broken boiler'}
              placeholderTextColor={C.faint}
              multiline
              style={styles.textarea}
            />
            <Button title="Start drafting" icon="arrow-forward" onPress={() => go({ text })} loading={busy === 'text'} disabled={!text.trim() || !!busy} style={{ backgroundColor: accent }} />
          </View>

          {notice ? <Banner tone={notice.tone} icon={notice.tone === 'warn' ? 'shield-outline' : 'information-circle'}>{notice.text}</Banner> : null}
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

          <View style={{ gap: S.sm }}>
            <T kind="caption">Or choose</T>
            {templates === undefined ? (
              <ActivityIndicator color={accent} />
            ) : (
              templates.map((t) => (
                <Pressable key={t.id} disabled={!!busy} onPress={() => go({ templateId: t.id })} style={({ pressed }) => [styles.option, pressed && { backgroundColor: C.bg }]}>
                  <Ionicons name={t.kind === 'agreement' ? 'document-text-outline' : 'mail-outline'} size={22} color={accent} />
                  <View style={{ flex: 1 }}>
                    <T kind="label">{t.title}</T>
                    <T kind="small" muted>{t.short}</T>
                  </View>
                  {busy === t.id ? <ActivityIndicator color={accent} /> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
                </Pressable>
              ))
            )}
          </View>

          {!remedy && !token ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={styles.consent}>
              <View style={[styles.box, consent && { backgroundColor: C.primary, borderColor: C.primary }]}>{consent ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
              <T kind="small" style={{ flex: 1 }}>I agree that Remedy can save the details I put in my letter, so I can edit it later. I can delete it at any time.</T>
            </Pressable>
          ) : null}

          <T kind="small" muted>We can’t draft wills, probate or property documents, leases, court forms, divorce papers or powers of attorney. We’ll tell you where to get help with those.</T>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  textarea: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, padding: S.lg, minHeight: 100, fontSize: 17, lineHeight: 24, color: C.text, textAlignVertical: 'top' },
  option: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, padding: S.lg },
  consent: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center' },
});
