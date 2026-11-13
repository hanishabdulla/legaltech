import { ConvexReactClient } from 'convex/react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

let url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error('EXPO_PUBLIC_CONVEX_URL is missing. Run `npx convex dev` first.');

// The Android emulator reaches the host machine on 10.0.2.2, not 127.0.0.1.
if (Platform.OS === 'android' && !Device.isDevice) {
  url = url.replace('127.0.0.1', '10.0.2.2').replace('localhost', '10.0.2.2');
}

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });
