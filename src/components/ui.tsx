import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, MaxWidth, R, S } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

/** Full-height page with a centred, width-limited column. */
export function Screen({
  children,
  scroll = true,
  footer,
  header,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  header?: ReactNode;
}) {
  const body = <View style={styles.column}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={footer ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      {header ? <View style={[styles.column, styles.headerRow]}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1 }]}>{body}</View>
      )}
      {footer ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={styles.column}>{footer}</View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

type TextKind = 'display' | 'title' | 'heading' | 'body' | 'label' | 'small' | 'caption';
export function T({
  kind = 'body',
  style,
  children,
  muted,
  center,
  numberOfLines,
  selectable,
}: {
  kind?: TextKind;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  muted?: boolean;
  center?: boolean;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[text[kind], muted && { color: C.muted }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? C.danger : C.primary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? C.primaryPressed : C.primary },
        variant === 'secondary' && { backgroundColor: pressed ? '#D3E8DD' : C.primarySoft },
        variant === 'ghost' && { backgroundColor: pressed ? C.primarySoft : 'transparent' },
        variant === 'danger' && { backgroundColor: pressed ? C.dangerSoft : 'transparent' },
        off && { opacity: 0.45 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

export function IconBubble({ name, color = C.primary, bg = C.primarySoft, size = 44 }: {
  name: IconName;
  color?: string;
  bg?: string;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

/** A tappable answer row: radio (single) or checkbox (multi). */
export function OptionRow({
  label,
  hint,
  selected,
  multi,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && !selected && { backgroundColor: '#F0F3EE' },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T kind="label" style={selected && { color: C.primary }}>{label}</T>
        {hint ? <T kind="small" muted>{hint}</T> : null}
      </View>
      <View
        style={[
          multi ? styles.checkbox : styles.radio,
          selected && { borderColor: C.primary, backgroundColor: C.primary },
        ]}>
        {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: C.primary, borderColor: C.primary },
        pressed && !selected && { backgroundColor: C.primarySoft },
      ]}>
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Banner({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success';
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}) {
  const palette = {
    info: [C.infoSoft, C.info],
    warn: [C.warnSoft, C.warn],
    danger: [C.dangerSoft, C.danger],
    success: [C.primarySoft, C.primary],
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette[0] }]}>
      {icon ? <Ionicons name={icon} size={22} color={palette[1]} style={{ marginTop: 1 }} /> : null}
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <T kind="label" style={{ color: palette[1] }}>{title}</T> : null}
        {typeof children === 'string' ? <T kind="small" style={{ color: C.text }}>{children}</T> : children}
      </View>
    </View>
  );
}

export function IconButton({ name, onPress, label }: { name: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: C.border }]}>
      <Ionicons name={name} size={22} color={C.text} />
    </Pressable>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} />
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />;
}

const text = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: C.text, letterSpacing: -0.6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: C.text },
  body: { fontSize: 16, lineHeight: 23, color: C.text },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: C.text },
  small: { fontSize: 14, lineHeight: 20, color: C.text },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  column: { width: '100%', maxWidth: MaxWidth, alignSelf: 'center' },
  headerRow: { paddingHorizontal: S.xl, paddingTop: S.sm, paddingBottom: S.sm },
  scrollContent: { paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.xxl },
  footer: { paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.md, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  button: {
    minHeight: 54,
    borderRadius: R.md,
    paddingHorizontal: S.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: S.lg + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    gap: S.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: S.lg,
    paddingHorizontal: S.lg,
    minHeight: 58,
  },
  optionSelected: { borderColor: C.primary, backgroundColor: '#F2F9F5' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#C4CCC6', alignItems: 'center', justifyContent: 'center' },
  chip: {
    paddingHorizontal: S.lg,
    paddingVertical: S.sm + 2,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipText: { fontSize: 15, fontWeight: '600', color: C.text },
  banner: { flexDirection: 'row', gap: S.md, padding: S.lg, borderRadius: R.md },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden', flex: 1 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: C.primary },
});
