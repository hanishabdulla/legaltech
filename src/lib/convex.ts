import { ConvexReactClient } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

let url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error('EXPO_PUBLIC_CONVEX_URL is missing. Run `npx convex dev` first.');

const isLocal = /127\.0\.0\.1|localhost/.test(url);
if (isLocal && Platform.OS !== 'web') {
  if (Device.isDevice) {
    // A real phone can't reach 127.0.0.1 on the laptop. Use the laptop's LAN IP,
    // which Metro already knows (the phone loaded the bundle from it).
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) url = url.replace(/127\.0\.0\.1|localhost/, host);
  } else if (Platform.OS === 'android') {
    // The Android emulator reaches the host machine on 10.0.2.2.
    url = url.replace(/127\.0\.0\.1|localhost/, '10.0.2.2');
  }
}

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });
