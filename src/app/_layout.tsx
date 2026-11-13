import { ConvexProvider } from 'convex/react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { C } from '@/constants/theme';
import { convex } from '@/lib/convex';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { ready } = useSession();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
  );
}

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navigator />
      </SessionProvider>
    </ConvexProvider>
  );
}
