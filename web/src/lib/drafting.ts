'use client';

import { useToken } from '@/lib/session';

export type DraftOwner = 'client' | 'business';

/** The session token for whoever owns drafts in this product. */
export function useOwnerToken(kind: DraftOwner) {
  return useToken(kind === 'client' ? 'client' : 'business');
}

export const draftHref = (kind: DraftOwner, id: string) => `/draft/?kind=${kind}&id=${id}`;
export const newDraftHref = (kind: DraftOwner, opts: { caseId?: string; template?: string; text?: string } = {}) => {
  const q = new URLSearchParams({ kind });
  if (opts.caseId) q.set('caseId', opts.caseId);
  if (opts.template) q.set('template', opts.template);
  if (opts.text) q.set('text', opts.text);
  return `/draft/new/?${q.toString()}`;
};
