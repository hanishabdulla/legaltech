'use client';

import Link from 'next/link';

import { Container } from '@/components/page';
import { Banner, Button } from '@/components/ui';

/** Shown when a page fails, e.g. a link with a mistyped id. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container narrow>
      <div className="space-y-4">
        <Banner tone="warn" title="We couldn’t open that page">The link may be out of date, or the item may have been deleted.</Banner>
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className="inline-flex h-11 items-center rounded-xl px-4 font-medium text-brand hover:bg-brand-soft">Go home</Link>
        </div>
      </div>
    </Container>
  );
}
