import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Ionicons, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';

export type Outcome = 'likely' | 'unlikely' | 'needs_info';

const OUTCOME_STYLE: Record<Outcome, { label: string; bg: string; fg: string; icon: IconName }> = {
  likely: { label: 'Likely', bg: C.primarySoft, fg: C.primary, icon: 'checkmark-circle' },
  needs_info: { label: 'Need more info', bg: C.warnSoft, fg: C.warn, icon: 'help-circle' },
  unlikely: { label: 'Unlikely', bg: '#EEF0EE', fg: C.muted, icon: 'remove-circle' },
};

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  const s = OUTCOME_STYLE[outcome];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={14} color={s.fg} />
      <T kind="small" style={{ color: s.fg, fontWeight: '700' }}>{s.label}</T>
    </View>
  );
}

/** "We understood:" chips. Tap the x to say it's wrong; it will be asked again. */
export function FactChips({ chips, onRemove }: { chips: { key: string; label: string }[]; onRemove?: (key: string) => void }) {
  if (!chips.length) return null;
  return (
    <View style={styles.chips}>
      {chips.map((c, i) => (
        <View key={`${c.key}-${i}`} style={styles.chip}>
          <T kind="small" style={{ color: C.primary, fontWeight: '600' }}>{c.label}</T>
          {onRemove ? (
            <Pressable accessibilityLabel={`Remove ${c.label}`} hitSlop={8} onPress={() => onRemove(c.key)}>
              <Ionicons name="close" size={15} color={C.primary} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

type Trace = { criterion: string; met: boolean | null; evidence: string };

export function SchemeCard({
  name,
  who,
  contact,
  outcome,
  explanation,
  toFinish,
  trace,
  flags,
  note,
}: {
  name: string;
  who?: string;
  contact?: string;
  outcome: Outcome;
  explanation?: string;
  toFinish: string[];
  trace: Trace[];
  flags?: string[];
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="label">{name}</T>
          {who ? <T kind="small" muted>{who}</T> : null}
        </View>
        <OutcomePill outcome={outcome} />
      </View>
      {explanation ? <T>{explanation}</T> : null}
      {note ? (
        <View style={styles.note}>
          <Ionicons name="information-circle" size={18} color={C.info} />
          <T kind="small" style={{ flex: 1 }}>{note}</T>
        </View>
      ) : null}
      {toFinish.length ? (
        <View style={{ gap: 6 }}>
          <T kind="caption">To finish this</T>
          {toFinish.map((t) => (
            <View key={t} style={styles.row}>
              <Ionicons name="ellipse-outline" size={14} color={C.warn} style={{ marginTop: 4 }} />
              <T kind="small" style={{ flex: 1 }}>{t}</T>
            </View>
          ))}
        </View>
      ) : null}
      {flags?.map((f) => (
        <View key={f} style={[styles.note, { backgroundColor: C.warnSoft }]}>
          <Ionicons name="flag" size={16} color={C.warn} />
          <T kind="small" style={{ flex: 1 }}>{f}</T>
        </View>
      ))}
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.traceToggle} hitSlop={6}>
        <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>{open ? 'Hide' : 'See'} how we checked</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.primary} />
      </Pressable>
      {open ? (
        <View style={{ gap: S.sm }}>
          {trace.map((t) => (
            <View key={t.criterion} style={styles.row}>
              <Ionicons
                name={t.met === null ? 'help-circle-outline' : t.met ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={t.met === null ? C.warn : t.met ? C.primary : C.danger}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <T kind="small">{t.criterion}</T>
                <T kind="small" muted>{t.evidence}</T>
              </View>
            </View>
          ))}
          {contact ? <T kind="small" muted>Phone: {contact}</T> : null}
        </View>
      ) : null}
    </Card>
  );
}

export type Step = { label: string; detail?: string; state: 'done' | 'current' | 'todo' };

export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <View>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const color = s.state === 'todo' ? C.border : C.primary;
        return (
          <View key={s.label} style={{ flexDirection: 'row', gap: S.md }}>
            <View style={{ alignItems: 'center', width: 26 }}>
              <View style={[styles.dot, { borderColor: color, backgroundColor: s.state === 'done' ? C.primary : C.surface }]}>
                {s.state === 'done' ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                {s.state === 'current' ? <View style={styles.dotInner} /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: s.state === 'done' ? C.primary : C.border }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : S.lg, gap: 2 }}>
              <T kind="label" style={s.state === 'todo' && { color: C.faint }}>{s.label}</T>
              {s.detail ? <T kind="small" muted>{s.detail}</T> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, paddingLeft: 12, paddingRight: 10, paddingVertical: 7, borderRadius: R.pill },
  row: { flexDirection: 'row', gap: S.sm },
  note: { flexDirection: 'row', gap: S.sm, backgroundColor: C.infoSoft, padding: S.md, borderRadius: R.sm },
  traceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  line: { width: 2, flex: 1, marginVertical: 2 },
});
