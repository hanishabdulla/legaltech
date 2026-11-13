import { router } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconButton, Ionicons, T } from '@/components/ui';
import { C, R, S } from '@/constants/theme';

const NEUTRAL_URL = 'https://www.bbc.co.uk/weather';

/** Quick exit to a neutral page, for anyone who may be watched or at risk. */
export function quickExit() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.replace(NEUTRAL_URL);
    return;
  }
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
  Linking.openURL(NEUTRAL_URL).catch(() => {});
}

export function ExitButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Exit this page quickly"
      onPress={quickExit}
      hitSlop={6}
      style={({ pressed }) => [styles.exit, pressed && { opacity: 0.8 }]}>
      <Ionicons name="close-circle" size={16} color="#fff" />
      <T kind="small" style={{ color: '#fff', fontWeight: '700' }}>Exit this page</T>
    </Pressable>
  );
}

export function ClientHeader({ title, back = true, onBack }: { title?: string; back?: boolean; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton name="arrow-back" label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
      ) : null}
      <T kind="heading" style={{ flex: 1 }} numberOfLines={1}>{title ?? ''}</T>
      <ExitButton />
    </View>
  );
}

export function NotAdvice() {
  return (
    <T kind="small" muted center style={{ marginTop: S.md }}>
      Information, not legal advice. An adviser checks everything before help is sent.
    </T>
  );
}

export function AiBadge({ approved }: { approved?: boolean }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="sparkles" size={13} color={C.info} />
      <T kind="small" style={{ color: C.info, fontWeight: '600' }}>
        {approved ? 'AI prepared · adviser approved' : 'AI prepared · an adviser will check'}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 44 },
  exit: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.danger, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.infoSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
});
