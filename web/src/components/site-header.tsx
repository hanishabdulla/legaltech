'use client';

import { Briefcase, ChevronDown, Leaf, Scale } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from '@/lib/format';

const NAV = [
  { href: '/help/', label: 'Get help', match: '/help' },
  { href: '/business/', label: 'For businesses', match: '/business' },
];

const STAFF = [
  { href: '/adviser/', label: 'Adviser (Common Counsel)', icon: Leaf },
  { href: '/lawyer/', label: 'Remedy lawyer', icon: Scale },
  { href: '/firm/', label: 'Partner firm', icon: Briefcase },
];

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const remedy = ['/business', '/lawyer', '/firm'].some((p) => pathname.startsWith(p));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className={cx('flex size-8 items-center justify-center rounded-lg text-white', remedy ? 'bg-remedy' : 'bg-brand')}>
            {remedy ? <Scale className="size-4" /> : <Leaf className="size-4" />}
          </span>
          <span className="hidden sm:inline">{remedy ? 'Remedy' : 'Common Counsel'}</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-semibold">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx('rounded-lg px-3 py-2 transition-colors hover:bg-surface', pathname.startsWith(n.match) && 'bg-surface text-brand')}>
              {n.label}
            </Link>
          ))}
        </nav>

        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface">
            Staff sign in <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {STAFF.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bg">
                <s.icon className="size-4 text-muted" /> {s.label}
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
      <div className="mx-auto max-w-7xl space-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-semibold text-ink">Common Counsel · Remedy</p>
        <p>Prototype for the LegalTech in Leeds Hackathon. Demo data only: no real vouchers, referrals, firms or legal advice.</p>
        <p>The AI reads, retrieves and drafts. Rules decide eligibility, flags and deadlines. A named person approves anything that leaves the app.</p>
      </div>
    </footer>
  );
}
