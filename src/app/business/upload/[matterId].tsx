import { useMutation, useQuery } from 'convex/react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BusinessNotice, Pill, RemedyHeader } from '@/components/remedy';
import { Banner, Button, Card, Chip, IconButton, Ionicons, Screen, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const KINDS = [
  { id: 'contract', label: 'Contract' },
  { id: 'term_sheet', label: 'Term sheet' },
  { id: 'shareholders_agreement', label: 'Shareholders’ agreement' },
  { id: 'lease', label: 'Lease' },
  { id: 'other', label: 'Other' },
];

const RISK = {
  high: { fg: C.danger, bg: C.dangerSoft, label: 'Look closely' },
  medium: { fg: C.warn, bg: C.warnSoft, label: 'Worth checking' },
  low: { fg: C.primary, bg: C.primarySoft, label: 'Standard' },
} as const;

export default function Upload() {
  const { matterId } = useLocalSearchParams<{ matterId: Id<'matters'> }>();
  const { businessToken } = useSession();
  const token = businessToken ?? '';
  const m = useQuery(api.matters.get, businessToken ? { token, matterId } : 'skip');
  const generateUploadUrl = useMutation(api.contracts.generateUploadUrl);
  const add = useMutation(api.contracts.add);
  const remove = useMutation(api.contracts.remove);
  const submit = useMutation(api.contracts.submit);
  const [kind, setKind] = useState('contract');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!businessToken) return <Redirect href="/business/start" />;

  async function upload(source: 'file' | 'photo') {
    setError(null);
    try {
      let blob: Blob;
      let type: string;
      if (source === 'file') {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, base64: false });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        setBusy(source);
        blob = asset.file ?? (await (await fetch(asset.uri)).blob());
        type = asset.mimeType ?? blob.type ?? 'application/pdf';
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
        if (res.canceled || !res.assets[0]) return;
        setBusy(source);
        const asset = res.assets[0];
        blob = await (await fetch(asset.uri)).blob();
        type = asset.mimeType ?? blob.type ?? 'image/jpeg';
      }
      const url = await generateUploadUrl({ token, matterId });
      const up = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body: blob });
      if (!up.ok) throw new Error('upload failed');
      const { storageId } = (await up.json()) as { storageId: Id<'_storage'> };
      await add({ token, matterId, storageId, kind });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setError(null);
    setBusy('send');
    try {
      await submit({ token, matterId });
      router.replace(`/business/matter/${matterId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const docs = m?.documents ?? [];
  const pending = docs.filter((d) => !d.submitted);
  const reading = pending.some((d) => d.status === 'reading');

  return (
    <Screen
      header={<RemedyHeader title="Attach a document" subtitle={m?.ref} back={`/business/matter/${matterId}`} />}
      footer={
        <Button
          title={reading ? 'Reading your document…' : 'Send to our lawyer'}
          icon="send"
          onPress={send}
          loading={busy === 'send'}
          disabled={!pending.length || reading}
        />
      }>
      <View style={{ gap: S.xl }}>
        <View style={{ gap: S.sm }}>
          <T kind="title">Show us the document</T>
          <T muted>Remedy highlights the clauses worth a closer look. You’ll see them before anything goes to our lawyer.</T>
        </View>

        <View style={{ gap: S.sm }}>
          <T kind="label">What is it?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
            {KINDS.map((k) => <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />)}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: S.md }}>
          <Button title="Choose PDF" icon="document-outline" onPress={() => upload('file')} loading={busy === 'file'} disabled={!!busy} style={{ flex: 1 }} />
          <Button title="Photo" icon="images-outline" variant="secondary" onPress={() => upload('photo')} loading={busy === 'photo'} disabled={!!busy} style={{ flex: 1 }} />
        </View>
        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}

        {docs.map((d) => (
          <Card key={d._id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Ionicons name="document-text-outline" size={22} color={C.primary} />
              <T kind="label" style={{ flex: 1, textTransform: 'capitalize' }}>{d.kind.replace(/_/g, ' ')}</T>
              {d.submitted ? (
                <Pill text="Sent to lawyer" fg={C.primary} bg={C.primarySoft} icon="checkmark" />
              ) : (
                <IconButton name="trash-outline" label="Remove document" onPress={() => remove({ token, docId: d._id }).catch((e) => setError(errorMessage(e)))} />
              )}
            </View>
            {d.status === 'reading' ? (
              <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
                <T kind="small" muted>Reading and highlighting clauses…</T>
              </View>
            ) : (
              <>
                <T kind="small" muted>{d.summary}</T>
                {d.clauses.map((c, i) => (
                  <View key={i} style={[styles.clause, { borderLeftColor: RISK[c.risk].fg }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
                      <T kind="label" style={{ flex: 1 }}>{c.title}</T>
                      <Pill text={RISK[c.risk].label} fg={RISK[c.risk].fg} bg={RISK[c.risk].bg} />
                    </View>
                    {c.text ? <T kind="small" style={{ fontStyle: 'italic' }}>“{c.text}”</T> : null}
                    <T kind="small" muted>{c.why}</T>
                  </View>
                ))}
              </>
            )}
          </Card>
        ))}
        <T kind="small" muted center>PDF or photo, up to 10MB. Remedy doesn’t copy names, bank details or signatures from documents.</T>
        <BusinessNotice />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clause: { gap: 4, paddingLeft: S.md, borderLeftWidth: 3, borderRadius: R.sm / 2, paddingVertical: S.xs },
});
