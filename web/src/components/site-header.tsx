'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from '@/lib/format';

const NAV = [
  { href: '/help/', label: 'Common Counsel', match: '/help' },
  { href: '/business/', label: 'Remedy', match: '/business' },
];

const STAFF = [
  { href: '/adviser/', label: 'Adviser queue', sub: 'Common Counsel' },
  { href: '/lawyer/', label: 'Lawyer portal', sub: 'Remedy' },
  { href: '/firm/', label: 'Partner firm', sub: 'Remedy' },
];

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const remedy = ['/business', '/lawyer', '/firm'].some((p) => pathname.startsWith(p));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-ink">
          <span className={cx('size-2 rounded-full', remedy ? 'bg-remedy' : 'bg-brand')} />
          <span className="font-serif text-lg font-medium tracking-normal">{remedy ? 'Remedy' : 'Common Counsel'}</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.match);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  'py-1 transition-colors',
                  active ? 'font-medium text-ink underline decoration-ink/40 underline-offset-[18px]' : 'text-muted hover:text-ink',
                )}>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-sm text-muted transition-colors hover:text-ink">
            Staff <ChevronDown className="size-3.5 transition group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-surface p-1 shadow-sm">
            {STAFF.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-baseline justify-between rounded-md px-3 py-2 text-sm hover:bg-bg">
                <span className="font-medium text-ink">{s.label}</span>
                <span className="text-xs text-faint">{s.sub}</span>
              </Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:px-6">
        <p className="font-medium text-ink">Common Counsel &amp; Remedy</p>
        <p>LegalTech in Leeds prototype · Demo data only, not legal advice.</p>
      </div>
    </footer>
  );
}
