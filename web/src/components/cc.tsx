'use client';

import { Check, ChevronDown, ChevronUp, CircleHelp, X, XCircle, CheckCircle2 } from '@/components/icons';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Pill } from '@/components/ui';
import { cx, daysLeft, money, shortDate, voucherStatus } from '@/lib/format';

/** Shared Remedy (MVP 1) pieces. */

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ur', label: 'اردو' },
  { id: 'pl', label: 'Polski' },
  { id: 'ar', label: 'العربية' },
  { id: 'ro', label: 'Română' },
  { id: 'ku', label: 'کوردی' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ' },
];

export const RETAILER_COLORS: Record<string, string> = {
  Tesco: '#00539F',
  Asda: '#3E8E1A',
  'Sainsbury’s': '#E86A10',
  Aldi: '#1B2A6B',
  Lidl: '#0050AA',
  Morrisons: '#00563F',
  'Co-op': '#0A7FA8',
  'Prepayment meter top-up': '#7A3E9D',
};
export const RETAILERS = ['Tesco', 'Asda', 'Sainsbury’s', 'Aldi', 'Lidl', 'Morrisons', 'Co-op'];

export const CASE_STATUS: Record<string, string> = {
  draft: 'Not sent yet',
  submitted: 'Sent to an adviser',
  in_review: 'Adviser checking',
  approved: 'Approved',
  rejected: 'Decision made',
  referred: 'Referred',
  closed: 'Closed',
};

const NEUTRAL_URL = 'https://www.bbc.co.uk/weather';

/** Quick exit to a neutral page, for anyone who may be watched or at risk. */
export function ExitButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.replace(NEUTRAL_URL)}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger hover:text-white">
      <X className="size-3.5" /> Quick exit
    </button>
  );
}

export function NotAdvice() {
  return <p className="text-xs text-muted">Information, not legal advice. An adviser reviews everything before help is sent.</p>;
}

export function AiBadge({ approved }: { approved?: boolean }) {
  return (
    <Pill tone={approved ? 'brand' : 'muted'}>
      {approved ? 'Adviser approved' : 'Prepared for adviser review'}
    </Pill>
  );
}

export type Outcome = 'likely' | 'unlikely' | 'needs_info';
export function OutcomePill({ outcome }: { outcome: Outcome }) {
  if (outcome === 'likely') return <Pill tone="brand">Likely</Pill>;
  if (outcome === 'needs_info') return <Pill tone="warn">Needs info</Pill>;
  return <Pill tone="muted">Unlikely</Pill>;
}

/** "We understood" chips. The × forgets a fact so it gets asked again. */
export function FactChips({ chips, onRemove }: { chips: { key: string; label: string }[]; onRemove?: (key: string) => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span key={`${c.key}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-2.5 py-1 text-xs text-ink">
          {c.label}
          {onRemove ? (
            <button type="button" aria-label={`Remove ${c.label}`} onClick={() => onRemove(c.key)} className="text-faint hover:text-ink">
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

type Trace = { criterion: string; met: boolean | null; evidence: string };

export function SchemeCard(props: {
  name: string;
  who?: string;
  contact?: string;
  outcome: Outcome;
  explanation?: string;
  toFinish: string[];
  trace: Trace[];
  flags?: string[];
  note?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{props.name}</p>
          {props.who ? <p className="text-xs text-muted">{props.who}</p> : null}
        </div>
        <OutcomePill outcome={props.outcome} />
      </div>
      {props.explanation ? <p className="text-sm text-muted leading-relaxed">{props.explanation}</p> : null}
      {props.note ? (
        <p className="border-l-2 border-info bg-info-soft/50 px-3 py-2 text-xs text-muted">
          {props.note}
        </p>
      ) : null}
      {props.toFinish.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium tracking-wider text-muted uppercase">To finish</p>
          <ul className="space-y-1 text-sm text-ink">
            {props.toFinish.map((t) => (
              <li key={t} className="flex gap-2"><span className="text-warn">·</span>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.flags?.map((f) => (
        <p key={f} className="border-l-2 border-warn bg-warn-soft/50 px-3 py-2 text-xs text-warn">
          {f}
        </p>
      ))}
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        {open ? 'Hide criteria' : 'See criteria checked'} {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-line pt-3">
          {props.trace.map((t) => (
            <li key={t.criterion} className="flex gap-2.5 text-xs">
              {t.met === null ? (
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-warn" />
              ) : t.met ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-brand" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              )}
              <span>
                <span className="text-ink">{t.criterion}</span>
                <span className="block text-muted">{t.evidence}</span>
              </span>
            </li>
          ))}
          {props.contact ? <li className="text-xs text-muted">Phone: {props.contact}</li> : null}
        </ul>
      ) : null}
      {props.children}
    </div>
  );
}

export type Step = { label: string; detail?: string; state: 'done' | 'current' | 'todo' };
export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3">
          <div className="flex w-5 flex-col items-center">
            <span
              className={cx(
                'flex size-5 items-center justify-center rounded-full border text-xs',
                s.state === 'todo' ? 'border-line bg-surface' : 'border-brand',
                s.state === 'done' && 'bg-brand text-white',
              )}>
              {s.state === 'done' ? <Check className="size-3" /> : s.state === 'current' ? <span className="size-1.5 rounded-full bg-brand" /> : null}
            </span>
            {i < steps.length - 1 ? <span className={cx('my-1 w-px flex-1', s.state === 'done' ? 'bg-brand' : 'bg-line')} /> : null}
          </div>
          <div className={cx('flex-1', i < steps.length - 1 && 'pb-5')}>
            <p className={cx('text-sm font-medium', s.state === 'todo' ? 'text-faint' : 'text-ink')}>{s.label}</p>
            {s.detail ? <p className="text-xs text-muted">{s.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

type Voucher = { _id: string; kind: 'food' | 'fuel'; retailer: string; valuePence: number; expiresAt: number; usedAt?: number };

export function VoucherCard({ voucher, href, compact }: { voucher: Voucher; href?: string; compact?: boolean }) {
  const status = voucherStatus(voucher);
  const color = status === 'active' ? (RETAILER_COLORS[voucher.retailer] ?? '#0c4a34') : '#8c8a84';
  const left = daysLeft(voucher.expiresAt);
  const body = (
    <div className="relative overflow-hidden rounded-xl p-5 text-white" style={{ backgroundColor: color }}>
      <div className="flex items-center justify-between text-xs text-white/80">
        <span className="font-medium uppercase tracking-wider">
          {voucher.kind === 'food' ? 'Food voucher' : 'Energy top-up'}
        </span>
        <StatusPill status={status} left={left} />
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-sm font-medium text-white/90">{voucher.retailer}</p>
        <p className={cx('font-serif font-medium tracking-tight tabular-nums', compact ? 'text-2xl' : 'text-4xl')}>{money(voucher.valuePence)}</p>
      </div>
      <p className="mt-2 text-xs text-white/75">
        {status === 'used' && voucher.usedAt ? `Used ${shortDate(voucher.usedAt)}` : status === 'expired' ? `Expired ${shortDate(voucher.expiresAt)}` : `Valid until ${shortDate(voucher.expiresAt)}`}
      </p>
    </div>
  );
  return href ? <Link href={href} className="block transition-opacity hover:opacity-95">{body}</Link> : body;
}

export function StatusPill({ status, left }: { status: 'active' | 'used' | 'expired'; left: number }) {
  const label = status === 'active' ? (left <= 1 ? 'Expires today' : `${left}d left`) : status === 'used' ? 'Used' : 'Expired';
  const urgent = status === 'active' && left <= 5;
  return <span className={cx('rounded-xs px-2 py-0.5 text-[11px] font-medium', urgent ? 'bg-accent text-ink' : 'bg-white/15 text-white')}>{label}</span>;
}

/** Where a case should open, depending on how far it has got. */
export const caseHref = (id: string) => `/help/case/?id=${id}`;
