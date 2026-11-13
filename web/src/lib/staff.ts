'use client';

import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { setToken, useToken, type TokenKind } from '@/lib/session';
import { api } from '@convex/_generated/api';

const ROLES: Record<'staff' | 'lawyer' | 'firm', string[]> = {
  staff: ['adviser', 'supervisor', 'admin'],
  lawyer: ['lawyer', 'admin'],
  firm: ['firm'],
};

/**
 * Staff session for one portal. Returns `loading`, `signedOut` or the staff
 * member. Drops tokens the server no longer knows or that have the wrong role.
 */
export function useStaff(kind: Extract<TokenKind, 'staff' | 'lawyer' | 'firm'>) {
  const token = useToken(kind);
  const me = useQuery(api.sessions.staffMe, token ? { token } : 'skip');
  const wrongRole = !!me && !ROLES[kind].includes(me.role);

  useEffect(() => {
    if (token && (me === null || wrongRole)) setToken(kind, null);
  }, [token, me, wrongRole, kind]);

  if (token === undefined || (token && me === undefined)) return { state: 'loading' as const };
  if (!token || !me || wrongRole) return { state: 'signedOut' as const };
  return { state: 'signedIn' as const, token, me, signOut: () => setToken(kind, null) };
}
