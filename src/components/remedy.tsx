import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Card, IconBubble, IconButton, Ionicons, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';

/** Shared bits for the Remedy (MVP 2) business, lawyer and firm screens. */

export const FLAG_LABELS: Record<string, string> = {
  NEEDS_JUDGEMENT: 'Needs legal judgement',
  MISSING_FACTS: 'Missing facts',
  DEADLINE_RISK: 'Deadline risk',
  HIGH_VALUE: 'High value',
  RESERVED_ACTIVITY: 'Reserved activity',
  DOC_REVIEW: 'Document review',
  LOW_CONFIDENCE: 'Low confidence',
  OUT_OF_SCOPE: 'Out of scope',
};

export const TOPIC_LABELS: Record<string, string> = {
  employment: 'Employment',
  contracts: 'Contracts',
  data: 'Data',
  ip: 'IP',
  company: 'Company',
  property: 'Premises',
  consumer: 'Consumers',
  other: 'Other',
};

export const SECTORS = [
  { id: 'creative', label: 'Creative services' },
  { id: 'tech', label: 'Tech' },
  { id: 'retail', label: 'Retail' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'professional', label: 'Professional services' },
  { id: 'construction', label: 'Construction' },
  { id: 'health', label: 'Health' },
  { id: 'other', label: 'Other' },
];
export const sectorLabel = (id: string) => SECTORS.find((s) => s.id === id)?.label ?? id;

export const STAGES = [
  { id: 'idea', label: 'Idea', hint: 'Not trading yet' },
  { id: 'trading', label: 'Trading', hint: 'Selling to customers' },
  { id: 'raising', label: 'Raising', hint: 'Raising investment' },
] as const;
export type Stage = (typeof STAGES)[number]['id'];

export type MatterStatus = 'answering' | 'answered' | 'in_review' | 'awaiting_client' | 'lawyer_checked' | 'referral_suggested' | 'closed';

const STATUS: Record<MatterStatus, { label: string; fg: string; bg: string; icon: IconName }> = {
  answering: { label: 'Answering…', fg: C.info, bg: C.infoSoft, icon: 'sparkles' },
  answered: { label: 'AI answer', fg: C.info, bg: C.infoSoft, icon: 'sparkles' },
  in_review: { label: 'Lawyer checking', fg: C.warn, bg: C.warnSoft, icon: 'hourglass-outline' },
  awaiting_client: { label: 'Lawyer needs info', fg: C.danger, bg: C.dangerSoft, icon: 'chatbubble-ellipses-outline' },
  lawyer_checked: { label: 'Lawyer-checked', fg: C.primary, bg: C.primarySoft, icon: 'shield-checkmark' },
  referral_suggested: { label: 'Firm recommended', fg: C.remedy, bg: '#E7E9EF', icon: 'business-outline' },
  closed: { label: 'Closed', fg: C.muted, bg: '#EEF0EE', icon: 'checkmark-done' },
};

export function Pill({ text, fg, bg, icon }: { text: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <T kind="small" style={{ color: fg, fontWeight: '700' }}>{text}</T>
    </View>
  );
}

export function StatusBadge({ status, checkedBy }: { status: MatterStatus; checkedBy?: string }) {
  const s = STATUS[status];
  const text = status === 'lawyer_checked' && checkedBy ? `Lawyer-checked by ${checkedBy}` : s.label;
  return <Pill text={text} fg={s.fg} bg={s.bg} icon={s.icon} />;
}

export function FlagChips({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <View style={styles.row}>
      {codes.map((c) => (
        <Pill key={c} text={FLAG_LABELS[c] ?? c} fg={c === 'DEADLINE_RISK' || c === 'RESERVED_ACTIVITY' ? C.danger : C.warn} bg={c === 'DEADLINE_RISK' || c === 'RESERVED_ACTIVITY' ? C.dangerSoft : C.warnSoft} icon="flag" />
      ))}
    </View>
  );
}

export function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else Linking.openURL(url).catch(() => {});
}

export type Citation = { act: string; section: string; url: string; heading?: string };
export const citeLabel = (c: { act: string; section: string }) =>
  c.act.startsWith('GOV.UK') ? `${c.act}: ${c.section}` : `${c.act}, ${c.act === 'UK GDPR' ? 'Art.' : 's.'}${c.section}`;

export function Citations({ citations, title = 'Legislation relied on' }: { citations: Citation[]; title?: string }) {
  if (!citations.length) return null;
  return (
    <View style={{ gap: S.sm }}>
      <T kind="caption">{title}</T>
      {citations.map((c) => (
        <Pressable key={c.url} onPress={() => openUrl(c.url)} style={({ pressed }) => [styles.cite, pressed && { opacity: 0.7 }]} accessibilityRole="link">
          <Ionicons name={c.act.startsWith('GOV.UK') ? 'globe-outline' : 'book-outline'} size={16} color={C.info} />
          <View style={{ flex: 1 }}>
            <T kind="small" style={{ color: C.info, fontWeight: '600' }}>{citeLabel(c)}</T>
            {c.heading ? <T kind="small" muted numberOfLines={1}>{c.heading}</T> : null}
          </View>
          <Ionicons name="open-outline" size={14} color={C.info} />
        </Pressable>
      ))}
    </View>
  );
}

export function RemedyHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: string | (() => void); right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton
          name="arrow-back"
          label="Back"
          onPress={typeof back === 'function' ? back : () => (router.canGoBack() ? router.back() : router.replace(back as never))}
        />
      ) : (
        <IconBubble name="scale" size={34} color="#fff" bg={C.remedy} />
      )}
      <View style={{ flex: 1 }}>
        <T kind="heading" numberOfLines={1}>{title}</T>
        {subtitle ? <T kind="small" muted numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: S.sm }}>
      <T kind="label">{label}</T>
      {hint ? <T kind="small" muted>{hint}</T> : null}
      <TextInput placeholderTextColor={C.faint} style={[styles.input, props.multiline && styles.textarea, style]} {...props} />
    </View>
  );
}

export const inputStyle = StyleSheet.create({
  input: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, paddingHorizontal: S.lg, height: 54, fontSize: 17, color: C.text },
  textarea: { height: undefined, minHeight: 120, paddingVertical: S.md, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
});

export function Check({ label, hint, checked, onPress }: { label: string; hint?: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.check}>
      <View style={[styles.box, checked && { backgroundColor: C.primary, borderColor: C.primary }]}>
        {checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T kind="small" style={{ fontWeight: '600' }}>{label}</T>
        {hint ? <T kind="small" muted>{hint}</T> : null}
      </View>
    </Pressable>
  );
}

export function Section({ n, title, children, style }: { n?: number; title: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: S.sm }, style]}>
      <T kind="caption">{n ? `${n}. ` : ''}{title}</T>
      {children}
    </View>
  );
}

export function Bullets({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return empty ? <T kind="small" muted>{empty}</T> : null;
  return (
    <View style={{ gap: 4 }}>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: S.sm }}>
          <T kind="small" muted>•</T>
          <T kind="small" style={{ flex: 1 }}>{x}</T>
        </View>
      ))}
    </View>
  );
}

/** Re-renders every `ms` so service-level timers stay current (no wall clock in Convex queries). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function dueLabel(dueAt: number | undefined, now: number) {
  if (!dueAt) return null;
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
  return { overdue: diff < 0, text: diff < 0 ? `Overdue by ${span}` : `Due in ${span}` };
}

export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function BusinessNotice() {
  return (
    <T kind="small" muted center style={{ marginTop: S.md }}>
      Remedy prototype. General information about the law in England and Wales, not legal advice, unless a named Remedy lawyer has checked it.
    </T>
  );
}

export function EmptyCard({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: S.xl }}>
      <IconBubble name={icon} size={52} color={C.remedy} bg="#E7E9EF" />
      <T kind="label" center>{title}</T>
      <T kind="small" muted center>{text}</T>
    </Card>
  );
}

export const TRIGGER_LABEL: Record<string, string> = {
  traction: 'Growth (traction score)',
  lawyer: 'Recommended by a Remedy lawyer',
  reserved_activity: 'Reserved legal activity',
};

export const REFERRAL_STATUS: Record<string, { text: string; fg: string; bg: string }> = {
  sent: { text: 'New', fg: C.info, bg: C.infoSoft },
  accepted: { text: 'Accepted', fg: C.primary, bg: C.primarySoft },
  declined: { text: 'Declined', fg: C.muted, bg: '#EEF0EE' },
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 44 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  cite: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.sm, backgroundColor: C.infoSoft },
  input: inputStyle.input,
  textarea: inputStyle.textarea,
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: S.xs },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
