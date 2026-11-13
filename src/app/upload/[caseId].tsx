import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FactChips } from '@/components/case-bits';
import { ClientHeader, NotAdvice } from '@/components/client-chrome';
import { Banner, Button, Card, IconBubble, Ionicons, Screen, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { factChips, type Facts } from '@convex/lib/facts';

const KINDS: { id: string; label: string; icon: IconName; hint: string }[] = [
  { id: 'sanction_letter', label: 'Benefits decision or sanction letter', icon: 'mail-outline', hint: 'We find the date, so we can work out your deadline' },
  { id: 'uc_statement', label: 'Universal Credit statement', icon: 'receipt-outline', hint: 'We look for payments and deductions' },
  { id: 'meter_photo', label: 'Photo of your meter', icon: 'speedometer-outline', hint: 'We read the credit left' },
  { id: 'bank_statement', label: 'Bank statement', icon: 'card-outline', hint: 'We read your balance only' },
  { id: 'other', label: 'Something else', icon: 'document-outline', hint: 'A bill or any other letter' },
];

export default function Upload() {
  const { caseId } = useLocalSearchParams<{ caseId: Id<'cases'> }>();
  const { clientToken } = useSession();
  const token = clientToken ?? '';
  const c = useQuery(api.cases.get, clientToken ? { token, caseId } : 'skip');
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const add = useMutation(api.documents.add);
  const confirm = useMutation(api.documents.confirm);
  const remove = useMutation(api.documents.remove);

  const [kind, setKind] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clientToken) return <Redirect href="/start" />;

  async function pick(source: 'camera' | 'library') {
    if (!kind) return;
    setError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError('Camera permission is needed to take a photo. You can choose a photo instead.');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const asset = res.assets[0];
      const blob = await (await fetch(asset.uri)).blob();
      const url = await generateUploadUrl({ token, caseId });
      const up = await fetch(url, { method: 'POST', headers: { 'Content-Type': asset.mimeType ?? blob.type ?? 'image/jpeg' }, body: blob });
      if (!up.ok) throw new Error('upload failed');
      const { storageId } = (await up.json()) as { storageId: Id<'_storage'> };
      await add({ token, caseId, storageId, kind });
      setKind(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const docs = c?.documents ?? [];

  return (
    <Screen
      header={<ClientHeader title="Add a document" />}
      footer={<Button title="Done" variant={docs.length ? 'primary' : 'secondary'} onPress={() => router.back()} />}>
      <View style={{ gap: S.xl }}>
        <View style={{ gap: S.sm }}>
          <T kind="title">Show us a letter or your meter</T>
          <T muted>We’ll read it and show you what we found. Nothing counts until you say it’s right.</T>
        </View>

        {docs.map((d) => (
          <DocCard
            key={d._id}
            doc={d}
            onConfirm={(facts) => confirm({ token, docId: d._id, facts })}
            onRemove={() => remove({ token, docId: d._id })}
          />
        ))}

        <View style={{ gap: S.sm }}>
          <T kind="heading">{docs.length ? 'Add another' : 'What is it?'}</T>
          {KINDS.map((k) => (
            <Pressable key={k.id} onPress={() => setKind(k.id)} style={[styles.kind, kind === k.id && styles.kindOn]}>
              <IconBubble name={k.icon} size={40} />
              <View style={{ flex: 1 }}>
                <T kind="label">{k.label}</T>
                <T kind="small" muted>{k.hint}</T>
              </View>
              {kind === k.id ? <Ionicons name="checkmark-circle" size={22} color={C.primary} /> : null}
            </Pressable>
          ))}
        </View>

        {kind ? (
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <Button title="Take photo" icon="camera-outline" onPress={() => pick('camera')} loading={busy} style={{ flex: 1 }} />
            <Button title="Choose" icon="images-outline" variant="secondary" onPress={() => pick('library')} disabled={busy} style={{ flex: 1 }} />
          </View>
        ) : null}

        {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
        <T kind="small" muted center>Cover any account numbers if you can. We never read names, addresses or NI numbers.</T>
        <NotAdvice />
      </View>
    </Screen>
  );
}

type Doc = {
  _id: Id<'documents'>;
  kind: string;
  status: 'reading' | 'read' | 'failed';
  extracted?: Facts;
  summary?: string;
  confidence: number;
  confirmedByClient: boolean;
  url: string | null;
};

function DocCard({ doc, onConfirm, onRemove }: { doc: Doc; onConfirm: (f: Facts) => Promise<unknown>; onRemove: () => void }) {
  const [busy, setBusy] = useState(false);
  const chips = doc.extracted ? factChips(doc.extracted) : [];
  const label = KINDS.find((k) => k.id === doc.kind)?.label ?? 'Document';

  return (
    <Card style={{ gap: S.md }}>
      <View style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
        {doc.url ? <Image source={{ uri: doc.url }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="label">{label}</T>
          {doc.status === 'reading' ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.primary} />
              <T kind="small" muted>Reading it now…</T>
            </View>
          ) : (
            <T kind="small" muted>{doc.summary}</T>
          )}
        </View>
      </View>

      {doc.status === 'read' && chips.length ? (
        <>
          <T kind="caption">{doc.confirmedByClient ? 'You confirmed' : 'Is this right?'}</T>
          <FactChips chips={chips} />
          {doc.confidence < 0.6 && !doc.confirmedByClient ? (
            <Banner tone="warn" icon="eye-outline">We weren’t very sure about this one. Please check it carefully.</Banner>
          ) : null}
          {!doc.confirmedByClient ? (
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <Button
                title="Yes, that’s right"
                icon="checkmark"
                onPress={async () => {
                  setBusy(true);
                  await onConfirm(doc.extracted ?? {}).finally(() => setBusy(false));
                }}
                loading={busy}
                style={{ flex: 1 }}
              />
              <Button title="No" variant="danger" onPress={onRemove} />
            </View>
          ) : null}
        </>
      ) : null}
      {doc.status !== 'reading' && (!chips.length || doc.status === 'failed') ? (
        <Button title="Remove" variant="danger" icon="trash-outline" onPress={onRemove} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, padding: S.md },
  kindOn: { borderColor: C.primary, backgroundColor: '#F2F9F5' },
  thumb: { width: 56, height: 56, borderRadius: R.sm, backgroundColor: C.bg },
});
