import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ExitButton } from '@/components/client-chrome';
import { Banner, Button, Card, Chip, IconBubble, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { LANGUAGES, caseHref, useEnsureClient } from '@/lib/client';
import { draftHref, newDraftHref } from '@/lib/drafting';
import { errorMessage, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';

const QUICK = [
  { icon: 'cut-outline', text: 'My benefits were sanctioned or cut' },
  { icon: 'time-outline', text: 'My Universal Credit is late' },
  { icon: 'flash-outline', text: 'I can’t top up my gas or electric' },
  { icon: 'basket-outline', text: 'I have no food' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Not sent yet',
  submitted: 'Sent to an adviser',
  in_review: 'Adviser checking',
  approved: 'Approved',
  rejected: 'Decision made',
  referred: 'Referred',
  closed: 'Closed',
};

export default function Start() {
  const { clientToken, setClientToken } = useSession();
  const me = useQuery(api.sessions.client, clientToken ? { token: clientToken } : 'skip');
  const cases = useQuery(api.cases.mine, clientToken && me ? { token: clientToken } : 'skip');
  const vouchers = useQuery(api.vouchers.list, clientToken && me ? { token: clientToken } : 'skip');
  const drafts = useQuery(api.drafting.mine, clientToken && me ? { kind: 'client', token: clientToken } : 'skip');
  const ensureClient = useEnsureClient();
  const createCase = useMutation(api.cases.create);
  const setLanguageRemote = useMutation(api.sessions.setLanguage);
  const deleteMyData = useMutation(api.sessions.deleteMyData);

  const [localLanguage, setLocalLanguage] = useState('en');
  const language = me?.language ?? localLanguage;
  const [story, setStory] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSession = !!clientToken && !!me;

  // A saved session that no longer exists on the server (e.g. data deleted) is dropped.
  useEffect(() => {
    if (clientToken && me === null) setClientToken(null);
  }, [clientToken, me, setClientToken]);
  const consented = hasSession || consent;

  async function chooseLanguage(id: string) {
    setLocalLanguage(id);
    if (hasSession) await setLanguageRemote({ token: clientToken!, language: id }).catch(() => {});
  }

  async function begin(text: string, mode: 'chat' | 'steps') {
    setError(null);
    if (!consented) return setError('Please tick the box to agree to how we use your information.');
    setBusy(mode === 'steps' ? 'steps' : text);
    try {
      const token = await ensureClient(language);
      const caseId = await createCase({ token, story: text });
      setStory('');
      router.push(mode === 'steps' ? `/steps/${caseId}` : `/intake/${caseId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    const run = async () => {
      if (clientToken) await deleteMyData({ token: clientToken }).catch(() => {});
      await setClientToken(null);
    };
    const msg = 'This permanently deletes everything you’ve told us, your documents and your vouchers.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete my data?\n\n${msg}`)) run();
    } else {
      Alert.alert('Delete my data?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={
          <View style={styles.header}>
            <View style={styles.brand}>
              <IconBubble name="leaf" size={34} />
              <T kind="heading">Common Counsel</T>
            </View>
            <ExitButton />
          </View>
        }>
        <View style={{ gap: S.xl }}>
          <View style={styles.langs}>
            {LANGUAGES.map((l) => (
              <Chip key={l.id} label={l.label} selected={language === l.id} onPress={() => chooseLanguage(l.id)} />
            ))}
          </View>

          {cases?.length ? (
            <View style={{ gap: S.md }}>
              <T kind="heading">Your cases</T>
              {cases.slice(0, 3).map((c) => (
                <Card key={c._id} onPress={() => router.push(caseHref(c))} style={styles.caseRow}>
                  <IconBubble name={c.status === 'approved' ? 'checkmark' : c.status === 'draft' ? 'create-outline' : 'hourglass-outline'} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T kind="label" numberOfLines={1}>{c.story || 'Step-by-step check'}</T>
                    <T kind="small" muted>{STATUS_LABEL[c.status]} · {shortDate(c.createdAt)}</T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Card>
              ))}
              {vouchers?.length ? (
                <Button title="My vouchers" icon="wallet-outline" variant="secondary" onPress={() => router.push('/wallet')} />
              ) : null}
            </View>
          ) : null}

          <View style={{ gap: S.sm }}>
            <T kind="display">What’s happened?</T>
            <T muted>Tell us in your own words. No account, no forms. We’ll ask a few questions and get it ready for an adviser.</T>
          </View>

          <View style={{ gap: S.sm }}>
            <TextInput
              value={story}
              onChangeText={(t) => setStory(t.slice(0, 2000))}
              placeholder="For example: I was sanctioned last week, I’ve got £40 left and my meter is on emergency credit."
              placeholderTextColor={C.faint}
              multiline
              textAlignVertical="top"
              style={styles.textarea}
            />
            <Button
              title="Continue"
              icon="arrow-forward"
              onPress={() => begin(story.trim(), 'chat')}
              loading={busy === story.trim() && !!story.trim()}
              disabled={!story.trim() || !!busy}
            />
          </View>

          <View style={{ gap: S.sm }}>
            <T kind="caption">Or start with</T>
            {QUICK.map((q) => (
              <Pressable
                key={q.text}
                disabled={!!busy}
                onPress={() => begin(q.text, 'chat')}
                style={({ pressed }) => [styles.quick, pressed && { backgroundColor: C.primarySoft }]}>
                <Ionicons name={q.icon} size={22} color={C.primary} />
                <T kind="label" style={{ flex: 1 }}>{q.text}</T>
                <Ionicons name="arrow-forward" size={18} color={C.faint} />
              </Pressable>
            ))}
          </View>

          {!hasSession ? (
            <View style={{ gap: S.sm }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((c) => !c)} style={styles.consent}>
                <View style={[styles.checkbox, consent && { backgroundColor: C.primary, borderColor: C.primary }]}>
                  {consent ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </View>
                <T kind="small" style={{ flex: 1 }}>
                  I agree that Common Counsel can save what I share, including health information like food needs, so an adviser can help me. I can delete it at any time.
                </T>
              </Pressable>
              <Pressable onPress={() => setShowPrivacy((s) => !s)} hitSlop={6}>
                <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>{showPrivacy ? 'Hide' : 'How we use your information'}</T>
              </Pressable>
              {showPrivacy ? (
                <Card style={{ gap: S.sm }}>
                  {[
                    'We don’t ask for your name, NI number or address to get started.',
                    'We keep only the first part of your postcode.',
                    'AI helps organise what you tell us. It never sees your name or contact details, and it never decides if you get help: the rules and an adviser do.',
                    'An adviser only sees your case once you send it to them.',
                    'You can delete everything from this screen at any time.',
                  ].map((line) => (
                    <View key={line} style={{ flexDirection: 'row', gap: S.sm }}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} style={{ marginTop: 2 }} />
                      <T kind="small" style={{ flex: 1 }}>{line}</T>
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>
          ) : null}

          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

          <Card onPress={() => router.push(newDraftHref('client'))} style={styles.caseRow}>
            <IconBubble name="document-text" size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <T kind="label">Need a letter written?</T>
              <T kind="small" muted>Benefits challenge, landlord repairs, deposit, debt or data request. We make the PDF.</T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Card>

          {drafts?.length ? (
            <View style={{ gap: S.sm }}>
              <T kind="heading">Your letters</T>
              {drafts.map((d) => (
                <Card key={d._id} onPress={() => router.push(draftHref('client', d._id))} style={styles.caseRow}>
                  <IconBubble name={d.status === 'generated' ? 'document' : 'create-outline'} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T kind="label" numberOfLines={1}>{d.title}</T>
                    <T kind="small" muted>{d.status === 'generated' ? `PDF ready · version ${d.version}` : 'In progress'}</T>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Card>
              ))}
            </View>
          ) : null}

          <Banner tone="danger" icon="call" title="In danger right now?">
            Call 999. National Domestic Abuse Helpline: 0808 2000 247 (free, 24 hours).
          </Banner>

          <View style={styles.links}>
            <Pressable onPress={() => begin('', 'steps')} hitSlop={6} disabled={!!busy}>
              <T kind="small" style={styles.link}>Answer step by step instead</T>
            </Pressable>
            {hasSession ? (
              <Pressable onPress={confirmDelete} hitSlop={6}>
                <T kind="small" style={[styles.link, { color: C.danger }]}>Delete my data</T>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/adviser')} hitSlop={6}>
              <T kind="small" style={[styles.link, { color: C.muted }]}>Adviser sign in</T>
            </Pressable>
            <Pressable onPress={() => router.push('/business')} hitSlop={6}>
              <T kind="small" style={[styles.link, { color: C.info }]}>Remedy for businesses</T>
            </Pressable>
          </View>
          <T kind="small" muted center>Prototype for the LegalTech in Leeds Hackathon. Information, not legal advice.</T>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  caseRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  textarea: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.lg,
    minHeight: 130,
    fontSize: 17,
    lineHeight: 24,
    color: C.text,
  },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    padding: S.lg,
  },
  consent: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: S.xl },
  link: { color: C.primary, fontWeight: '700' },
});
