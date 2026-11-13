import { useMutation } from 'convex/react';
import { useCallback } from 'react';

import { useSession } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ur', label: 'اردو' },
  { id: 'pl', label: 'Polski' },
  { id: 'ar', label: 'العربية' },
  { id: 'ro', label: 'Română' },
  { id: 'ku', label: 'کوردی' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ' },
];

/** Where a case should open, depending on how far it has got. */
export function caseHref(c: { _id: Id<'cases'>; status: string; intakeDone: boolean; assessed: boolean }) {
  if (c.status !== 'draft') return `/track/${c._id}` as const;
  if (c.assessed) return `/result/${c._id}` as const;
  return `/intake/${c._id}` as const;
}

/** Returns the client token, creating an anonymous session first if needed. */
export function useEnsureClient() {
  const { clientToken, setClientToken } = useSession();
  const start = useMutation(api.sessions.startClient);
  return useCallback(
    async (language: string) => {
      if (clientToken) return clientToken;
      const token = await start({ language });
      await setClientToken(token);
      return token;
    },
    [clientToken, setClientToken, start],
  );
}
