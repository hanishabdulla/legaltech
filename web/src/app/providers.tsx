'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set. Add it to web/.env.local.');

const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
