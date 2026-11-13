import { Redirect, Stack } from 'expo-router';

import { C } from '@/constants/theme';
import { useSession } from '@/lib/session';

/** Everything in this group needs a signed-in person. */
export default function AppLayout() {
  const { userId } = useSession();
  if (!userId) return <Redirect href="/sign-in" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="check" options={{ gestureEnabled: false }} />
      <Stack.Screen name="result/[id]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
