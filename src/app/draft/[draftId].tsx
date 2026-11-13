import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExitButton } from '@/components/client-chrome';
import { Banner, Button, Card, Chip, IconButton, Ionicons, T } from '@/components/ui';
import { C, MaxWidth, R, S } from '@/constants/theme';
import { useOwnerToken, type DraftOwner } from '@/lib/drafting';
import { errorMessage } from '@/lib/format';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Draft = FunctionReturnType<typeof api.drafting.get>;
type FieldRow = Draft['fields'][number];

export default function DraftScreen() {
  const { draftId, kind: kindParam } = useLocalSearchParams<{ draftId: Id<'drafts'>; kind?: string }>();
  const kind: DraftOwner = kindParam === 'business' ? 'business' : 'client';
  const token = useOwnerToken(kind);
  const d = useQuery(api.drafting.get, token ? { kind, token, draftId } : 'skip');
  const [tab, setTab] = useState<'chat' | 'answers'>('chat');

  if (!token) return <Redirect href={kind === 'client' ? '/start' : '/business'} />;
  if (d === undefined) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  const accent = kind === 'business' ? C.remedy : C.primary;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={[styles.col, styles.header]}>
          <IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(kind === 'client' ? '/start' : '/business'))} />
          <View style={{ flex: 1 }}>
            <T kind="heading" numberOfLines={1}>{d.title}</T>
            <T kind="small" muted>{d.ref} · {d.docKind === 'agreement' ? 'Agreement' : 'Letter'}</T>
          </View>
          {kind === 'client' ? <ExitButton /> : null}
        </View>
        <View style={[styles.col, styles.tabs]}>
          {(['chat', 'answers'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: accent }]}>
              <T kind="label" style={tab === t ? { color: accent } : { color: C.muted }}>
                {t === 'chat' ? 'Chat' : `Answers ${d.fields.length - d.missing.length}/${d.fields.length}`}
              </T>
            </Pressable>
          ))}
        </View>
        {tab === 'chat' ? <Chat d={d} kind={kind} token={token} accent={accent} /> : <Answers d={d} kind={kind} token={token} />}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Chat({ d, kind, token, accent }: { d: Draft; kind: DraftOwner; token: string; accent: string }) {
  const send = useAction(api.drafting.send);
  const generate = useAction(api.drafting.generate);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'send' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [d.transcript.length, busy]);

  async function reply(message: string) {
    if (!message.trim() || busy) return;
    setError(null);
    setBusy('send');
    setText('');
    try {
      await send({ kind, token, draftId: d._id, text: message });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function make() {
    setError(null);
    setBusy('generate');
    try {
      await generate({ kind, token, draftId: d._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const canMake = d.missing.length === 0;
  const stale = d.status === 'ready' && d.version > 0;

  return (
    <>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingVertical: S.md }} keyboardShouldPersistTaps="handled">
        <View style={[styles.col, { gap: S.md }]}>
          {d.warnings.map((w) => <Banner key={w} tone="warn" icon="alert-circle">{w}</Banner>)}
          {d.transcript.map((m, i) => (
            <View key={i} style={{ gap: S.sm, alignItems: m.role === 'client' ? 'flex-end' : 'flex-start' }}>
              <View style={[styles.bubble, m.role === 'client' ? [styles.mine, { backgroundColor: accent }] : styles.theirs]}>
                <T style={m.role === 'client' ? { color: '#fff' } : undefined}>{m.text}</T>
              </View>
              {m.pdf && m.pdfUrl ? <PdfCard url={m.pdfUrl} title={d.title} version={m.pdf.version} pages={m.pdf.pages} latest={m.pdf.version === d.version} /> : null}
            </View>
          ))}
          {busy ? (
            <View style={[styles.bubble, styles.theirs, { flexDirection: 'row', gap: S.sm, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={accent} />
              <T muted>{busy === 'generate' ? 'Writing your document…' : 'Reading that…'}</T>
            </View>
          ) : null}
          {d.status === 'generated' ? (
            <Card style={{ gap: S.sm }}>
              <T kind="label">What to do next</T>
              {d.nextSteps.map((s, i) => <T key={s} kind="small">{i + 1}. {s}</T>)}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.composer}>
        <View style={[styles.col, { gap: S.sm }]}>
          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          {canMake && d.status !== 'generated' ? (
            <Button title={stale ? 'Create the updated document' : 'Create my document'} icon={stale ? 'refresh' : 'sparkles'} onPress={make} loading={busy === 'generate'} style={{ backgroundColor: accent }} />
          ) : null}
          {!busy && d.nextField && !canMake ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }} keyboardShouldPersistTaps="handled">
              {d.nextField.suggestions.map((s) => <Chip key={s} label={s} onPress={() => reply(s)} />)}
            </ScrollView>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={canMake ? 'Want to change something? Tell me' : 'Type your answer'}
              placeholderTextColor={C.faint}
              multiline
              style={styles.input}
            />
            <Pressable accessibilityLabel="Send" disabled={!text.trim() || !!busy} onPress={() => reply(text)} style={[styles.send, { backgroundColor: accent }, (!text.trim() || !!busy) && { opacity: 0.4 }]}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          </View>
          <T kind="small" muted>The AI only collects your answers and tidies your words. The legal wording comes from a fixed template.</T>
        </View>
      </SafeAreaView>
    </>
  );
}

function PdfCard({ url, title, version, pages, latest }: { url: string; title: string; version: number; pages: number; latest: boolean }) {
  return (
    <View style={[styles.pdf, !latest && { opacity: 0.65 }]}>
      <View style={styles.pdfIcon}><T kind="small" style={{ color: C.danger, fontWeight: '800' }}>PDF</T></View>
      <View style={{ flex: 1 }}>
        <T kind="label" numberOfLines={1}>{title}</T>
        <T kind="small" muted>Version {version} · {pages} page{pages === 1 ? '' : 's'}{latest ? '' : ' · older'}</T>
      </View>
      <IconButton name="open-outline" label="Open PDF" onPress={() => Linking.openURL(url)} />
      <IconButton name="share-outline" label="Share PDF" onPress={() => Share.share(Platform.OS === 'ios' ? { url, message: title } : { message: `${title}: ${url}` })} />
    </View>
  );
}

function Answers({ d, kind, token }: { d: Draft; kind: DraftOwner; token: string }) {
  const remove = useMutation(api.drafting.remove);
  const [showPreview, setShowPreview] = useState(false);

  function confirmDelete() {
    const run = async () => {
      await remove({ kind, token, draftId: d._id });
      router.replace(kind === 'client' ? '/start' : '/business');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this document and its PDFs?')) run();
    } else {
      Alert.alert('Delete this document?', 'This deletes your answers and every PDF version.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: run }]);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: S.lg }} keyboardShouldPersistTaps="handled">
      <View style={[styles.col, { gap: S.lg }]}>
        {d.pdfUrl && d.status === 'generated' ? (
          <Button title={`Open PDF (version ${d.version})`} icon="document-outline" onPress={() => Linking.openURL(d.pdfUrl!)} />
        ) : null}
        <Card style={{ padding: 0, gap: 0 }}>
          {d.fields.map((f, i) => <AnswerRow key={f.key} f={f} d={d} kind={kind} token={token} first={i === 0} />)}
        </Card>
        {d.preview ? (
          <Card style={{ gap: S.sm }}>
            <Pressable onPress={() => setShowPreview(!showPreview)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T kind="label" style={{ flex: 1 }}>Preview the wording</T>
              <Ionicons name={showPreview ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
            </Pressable>
            {showPreview ? <T kind="small" selectable style={{ lineHeight: 21 }}>{d.preview}</T> : null}
          </Card>
        ) : null}
        <T kind="small" muted>
          {kind === 'client'
            ? 'A template filled in with your details. Show it to Citizens Advice if you’re not sure before you send it.'
            : 'A template filled in with your details. For anything high value or unusual, ask a Remedy lawyer to check it first.'}
        </T>
        <Button title="Delete this document" variant="danger" icon="trash-outline" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function AnswerRow({ f, d, kind, token, first }: { f: FieldRow; d: Draft; kind: DraftOwner; token: string; first: boolean }) {
  const setAnswer = useMutation(api.drafting.setAnswer);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    setValue(f.raw === '__blank__' || f.raw === '__skip__' ? '' : f.kind === 'money' && f.raw ? String(Number(f.raw) / 100) : f.raw);
    setEditing(true);
  }
  async function save(v = value) {
    setError(null);
    try {
      await setAnswer({ kind, token, draftId: d._id, key: f.key, value: v });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="small" muted>{f.label}{f.required ? '' : ' (optional)'}</T>
          {!editing ? <T kind="label" style={!f.done && { color: C.faint, fontWeight: '400' }}>{f.done ? f.display : 'Not answered yet'}</T> : null}
        </View>
        <IconButton name={editing ? 'close' : 'create-outline'} label={editing ? 'Cancel' : `Edit ${f.label}`} onPress={() => (editing ? setEditing(false) : open())} />
      </View>
      {editing ? (
        <View style={{ gap: S.sm }}>
          {f.kind === 'choice' || f.kind === 'yesno' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {(f.kind === 'yesno' ? [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] : f.options ?? []).map((o) => (
                <Chip key={o.id} label={o.label} selected={f.raw === o.id} onPress={() => save(o.id)} />
              ))}
            </View>
          ) : (
            <>
              <TextInput
                value={value}
                onChangeText={setValue}
                multiline={f.kind === 'longtext' || f.kind === 'address'}
                placeholder={f.kind === 'date' ? 'e.g. 3 November 2026' : f.kind === 'money' ? 'e.g. 4000' : ''}
                placeholderTextColor={C.faint}
                style={[styles.editInput, (f.kind === 'longtext' || f.kind === 'address') && { minHeight: 90, textAlignVertical: 'top' }]}
              />
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <Button title="Save" onPress={() => save()} style={{ minHeight: 40, flex: 1 }} />
                {f.placeholderOk || !f.required ? <Button title={f.placeholderOk ? 'Leave blank' : 'Skip'} variant="ghost" onPress={() => save('')} style={{ minHeight: 40 }} /> : null}
              </View>
            </>
          )}
          {error ? <T kind="small" style={{ color: C.danger }}>{error}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  col: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center', paddingHorizontal: S.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.sm },
  tabs: { flexDirection: 'row', gap: S.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginTop: S.sm },
  tab: { paddingVertical: S.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  bubble: { maxWidth: '86%', paddingHorizontal: S.lg, paddingVertical: S.md, borderRadius: 20 },
  mine: { borderBottomRightRadius: 6 },
  theirs: { backgroundColor: C.surface, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  pdf: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: S.sm, paddingLeft: S.md, maxWidth: '92%' },
  pdfIcon: { width: 40, height: 50, borderRadius: 6, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.bg, paddingTop: S.md, paddingBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: S.sm },
  input: { flex: 1, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 24, paddingHorizontal: S.lg, paddingTop: 13, paddingBottom: 13, fontSize: 17, maxHeight: 120, color: C.text },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  row: { padding: S.lg, gap: S.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  editInput: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: S.sm, fontSize: 16, color: C.text, minHeight: 44 },
});
