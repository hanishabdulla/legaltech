import { useAction, useMutation, useQuery } from 'convex/react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FactChips } from '@/components/case-bits';
import { ClientHeader } from '@/components/client-chrome';
import { Banner, Button, Chip, Ionicons, T } from '@/components/ui';
import { C, MaxWidth, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export default function Intake() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');
  const turn = useAction(api.intake.turn);
  const assess = useAction(api.intake.assess);
  const removeFact = useMutation(api.cases.removeFact);

  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function send(message: string) {
    if (!message.trim() || thinking) return;
    setError(null);
    setThinking(true);
    setText('');
    try {
      const res = await turn({ token, caseId, text: message.trim() });
      setAiFailed(res.aiFailed);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setThinking(false);
    }
  }

  // First turn: the story they typed on the start screen.
  useEffect(() => {
    if (!c || started.current) return;
    started.current = true;
    if (c.transcript.length === 0) {
      // Deferred so state updates happen outside the effect body.
      queueMicrotask(() => {
        if (c.story) send(c.story);
        else turn({ token, caseId }).catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [c?.transcript.length, thinking]);

  async function checkWhatICanGet() {
    setError(null);
    setChecking(true);
    try {
      await assess({ token, caseId });
      router.replace(`/result/${caseId}`);
    } catch (err) {
      setError(errorMessage(err));
      setChecking(false);
    }
  }

  if (!clientToken) return <Redirect href="/start" />;
  if (c === undefined) return <Loading />;
  if (c.status !== 'draft') return <Redirect href={`/track/${caseId}`} />;

  const q = c.nextQuestion;
  const enough = c.intakeDone || c.missing.length <= 2;

  if (checking) return <Loading label="Checking what you can get…" sub="Running the rules and preparing your summary." />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.col}>
          <ClientHeader title="Tell us more" onBack={() => router.replace('/start')} />
        </View>

        <ScrollView ref={scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.col, { gap: S.lg }]}>
            {c.safeguardingFlag ? (
              <Banner tone="danger" icon="heart" title="Your safety comes first">{c.safeguardingFlag}</Banner>
            ) : null}

            {c.chips.length ? (
              <View style={styles.understood}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={14} color={C.primary} />
                  <T kind="caption" style={{ color: C.primary }}>We understood</T>
                </View>
                <FactChips chips={c.chips} onRemove={(key) => removeFact({ token, caseId, key })} />
                <T kind="small" muted>Something wrong? Tap × and we’ll ask again.</T>
              </View>
            ) : null}

            {c.transcript.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'client' ? styles.mine : styles.theirs]}>
                <T style={m.role === 'client' ? { color: '#fff' } : undefined}>{m.text}</T>
              </View>
            ))}
            {thinking ? (
              <View style={[styles.bubble, styles.theirs, { flexDirection: 'row', gap: S.sm, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color={C.primary} />
                <T muted>Reading that…</T>
              </View>
            ) : null}

            {aiFailed ? (
              <Banner tone="warn" icon="cloud-offline-outline" title="Our assistant isn’t responding">
                You can answer step by step instead. Nothing you’ve said is lost.
              </Banner>
            ) : null}
            {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

            <Pressable onPress={() => router.push(`/upload/${caseId}`)} style={styles.upload}>
              <Ionicons name="document-attach-outline" size={22} color={C.primary} />
              <View style={{ flex: 1 }}>
                <T kind="label">Add a photo of a letter or your meter</T>
                <T kind="small" muted>
                  {c.documents.length ? `${c.documents.length} added` : 'Optional. We read it for you, and you check it.'}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Pressable>
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.composer}>
          <View style={[styles.col, { gap: S.sm }]}>
            {!thinking && q && !c.intakeDone ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }} keyboardShouldPersistTaps="handled">
                {q.suggestions.map((s) => (
                  <Chip key={s} label={s} onPress={() => send(s)} />
                ))}
              </ScrollView>
            ) : null}
            {c.intakeDone ? (
              <Button title="Check what I can get" icon="arrow-forward" onPress={checkWhatICanGet} />
            ) : (
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Type your answer"
                  placeholderTextColor={C.faint}
                  style={styles.input}
                  multiline
                  onSubmitEditing={() => send(text)}
                  blurOnSubmit
                  returnKeyType="send"
                />
                <Pressable
                  accessibilityLabel="Send"
                  disabled={!text.trim() || thinking}
                  onPress={() => send(text)}
                  style={[styles.send, (!text.trim() || thinking) && { opacity: 0.4 }]}>
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                </Pressable>
              </View>
            )}
            <View style={styles.footerLinks}>
              <Pressable onPress={() => router.push(`/steps/${caseId}`)} hitSlop={6}>
                <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>Answer step by step instead</T>
              </Pressable>
              {!c.intakeDone && enough ? (
                <Pressable onPress={checkWhatICanGet} hitSlop={6}>
                  <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>Skip to results</T>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Loading({ label, sub }: { label?: string; sub?: string }) {
  return (
    <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl }]}>
      <View style={styles.ring}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
      {label ? <T kind="heading" center>{label}</T> : null}
      {sub ? <T muted center>{sub}</T> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center', paddingHorizontal: S.xl },
  scrollContent: { paddingTop: S.md, paddingBottom: S.xl },
  understood: { gap: S.sm, backgroundColor: C.surface, padding: S.lg, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  bubble: { maxWidth: '86%', paddingHorizontal: S.lg, paddingVertical: S.md, borderRadius: 20 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.surface, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  upload: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg, borderRadius: R.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9C7BF', backgroundColor: C.surface },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.bg, paddingTop: S.md, paddingBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: S.sm },
  input: { flex: 1, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 24, paddingHorizontal: S.lg, paddingTop: 13, paddingBottom: 13, fontSize: 17, maxHeight: 120, color: C.text },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  footerLinks: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  ring: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
