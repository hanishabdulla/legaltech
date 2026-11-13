'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { Spinner } from '@/components/ui';
import { cx } from '@/lib/format';

/** Page width wrapper. `narrow` for single-column client flows. */
export function Container({ children, narrow, className }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return <div className={cx('mx-auto w-full px-4 py-8 sm:px-6', narrow ? 'max-w-2xl' : 'max-w-7xl', className)}>{children}</div>;
}

/** Wraps client pages that read the URL so they can be statically exported. */
export function WithParams({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

export function useIdParam<T extends string = string>(name = 'id') {
  return (useSearchParams().get(name) ?? '') as T;
}
