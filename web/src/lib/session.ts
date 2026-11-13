'use client';

import { useSyncExternalStore } from 'react';

/**
 * Demo session tokens, one per role, kept in localStorage (same keys as the
 * Expo app). Each is a random secret issued by Convex; only its hash is
 * stored server side. `undefined` means "not read yet" (during prerender).
 */
const KEYS = {
  client: 'cc.clientToken',
  staff: 'cc.staffToken',
  business: 'remedy.businessToken',
  lawyer: 'remedy.lawyerToken',
  firm: 'remedy.firmToken',
} as const;
export type TokenKind = keyof typeof KEYS;

const listeners = new Set<() => void>();

function read(kind: TokenKind): string | null {
  try {
    return window.localStorage.getItem(KEYS[kind]);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

export function setToken(kind: TokenKind, value: string | null) {
  try {
    if (value) window.localStorage.setItem(KEYS[kind], value);
    else window.localStorage.removeItem(KEYS[kind]);
  } catch {
    // Storage blocked (private mode): the session lasts until reload.
  }
  listeners.forEach((l) => l());
}

export function useToken(kind: TokenKind): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(kind),
    () => undefined,
  );
}
