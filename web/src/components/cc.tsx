'use client';

import { Check, ChevronDown, ChevronUp, CircleHelp, Flag, Info, Sparkles, X, XCircle, CheckCircle2, MinusCircle, Basket, Zap } from '@/components/icons';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Pill } from '@/components/ui';
import { cx, daysLeft, money, shortDate, voucherStatus } from '@/lib/format';

/** Shared Common Counsel (MVP 1) pieces. */

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
      className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3.5 py-2 text-sm font-bold text-white hover:bg-[#8f1c13]">
      <X className="size-4" /> Exit this page
    </button>
  );
}

export function NotAdvice() {
  return <p className="text-center text-sm text-muted">Information, not legal advice. An adviser checks everything before help is sent.</p>;
}

export function AiBadge({ approved }: { approved?: boolean }) {
  return (
    <Pill tone="info" icon={Sparkles}>
      {approved ? 'AI prepared · adviser approved' : 'AI prepared · an adviser will check'}
    </Pill>
  );
}

export type Outcome = 'likely' | 'unlikely' | 'needs_info';
export function OutcomePill({ outcome }: { outcome: Outcome }) {
  if (outcome === 'likely') return <Pill tone="brand" icon={CheckCircle2}>Likely</Pill>;
  if (outcome === 'needs_info') return <Pill tone="warn" icon={CircleHelp}>Need more info</Pill>;
  return <Pill tone="muted" icon={MinusCircle}>Unlikely</Pill>;
}

/** "We understood" chips. The × forgets a fact so it gets asked again. */
export function FactChips({ chips, onRemove }: { chips: { key: string; label: string }[]; onRemove?: (key: string) => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span key={`${c.key}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1.5 pr-2.5 pl-3 text-sm font-semibold text-brand">
          {c.label}
          {onRemove ? (
            <button type="button" aria-label={`Remove ${c.label}`} onClick={() => onRemove(c.key)} className="rounded-full p-0.5 hover:bg-white/60">
              <X className="size-3.5" />
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
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold">{props.name}</p>
          {props.who ? <p className="text-sm text-muted">{props.who}</p> : null}
        </div>
        <OutcomePill outcome={props.outcome} />
      </div>
      {props.explanation ? <p>{props.explanation}</p> : null}
      {props.note ? (
        <p className="flex gap-2 rounded-lg bg-info-soft p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" /> {props.note}
        </p>
      ) : null}
      {props.toFinish.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">To finish this</p>
          <ul className="space-y-1 text-sm">
            {props.toFinish.map((t) => (
              <li key={t} className="flex gap-2"><span className="text-warn">○</span>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.flags?.map((f) => (
        <p key={f} className="flex gap-2 rounded-lg bg-warn-soft p-3 text-sm">
          <Flag className="mt-0.5 size-4 shrink-0 text-warn" /> {f}
        </p>
      ))}
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
        {open ? 'Hide' : 'See'} how we checked {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open ? (
        <ul className="space-y-2">
          {props.trace.map((t) => (
            <li key={t.criterion} className="flex gap-2 text-sm">
              {t.met === null ? (
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-warn" />
              ) : t.met ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              )}
              <span>
                {t.criterion}
                <span className="block text-muted">{t.evidence}</span>
              </span>
            </li>
          ))}
          {props.contact ? <li className="text-sm text-muted">Phone: {props.contact}</li> : null}
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
          <div className="flex w-7 flex-col items-center">
            <span
              className={cx(
                'flex size-7 items-center justify-center rounded-full border-2',
                s.state === 'todo' ? 'border-line bg-surface' : 'border-brand',
                s.state === 'done' && 'bg-brand text-white',
              )}>
              {s.state === 'done' ? <Check className="size-4" /> : s.state === 'current' ? <span className="size-2.5 rounded-full bg-brand" /> : null}
            </span>
            {i < steps.length - 1 ? <span className={cx('my-1 w-0.5 flex-1', s.state === 'done' ? 'bg-brand' : 'bg-line')} /> : null}
          </div>
          <div className={cx('flex-1', i < steps.length - 1 && 'pb-5')}>
            <p className={cx('font-semibold', s.state === 'todo' && 'text-faint')}>{s.label}</p>
            {s.detail ? <p className="text-sm text-muted">{s.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

type Voucher = { _id: string; kind: 'food' | 'fuel'; retailer: string; valuePence: number; expiresAt: number; usedAt?: number };

export function VoucherCard({ voucher, href, compact }: { voucher: Voucher; href?: string; compact?: boolean }) {
  const status = voucherStatus(voucher);
  const color = status === 'active' ? (RETAILER_COLORS[voucher.retailer] ?? '#0e6b4e') : '#8d9792';
  const left = daysLeft(voucher.expiresAt);
  const body = (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ backgroundColor: color }}>
      <span className="absolute -top-16 -right-12 size-44 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
          {voucher.kind === 'food' ? <Basket className="size-4" /> : <Zap className="size-4" />}
          {voucher.kind === 'food' ? 'Food voucher' : 'Energy top-up'}
        </span>
        <StatusPill status={status} left={left} />
      </div>
      <p className="relative mt-4 font-semibold text-white/90">{voucher.retailer}</p>
      <p className={cx('relative font-extrabold tracking-tight', compact ? 'text-3xl' : 'text-5xl')}>{money(voucher.valuePence)}</p>
      <p className="relative text-xs text-white/75">Illustrative amount</p>
      <p className="relative mt-3 text-sm text-white/85">
        {status === 'used' && voucher.usedAt ? `Used ${shortDate(voucher.usedAt)}` : status === 'expired' ? `Expired ${shortDate(voucher.expiresAt)}` : `Valid until ${shortDate(voucher.expiresAt)}`}
      </p>
    </div>
  );
  return href ? <Link href={href} className="block transition hover:scale-[1.01]">{body}</Link> : body;
}

export function StatusPill({ status, left }: { status: 'active' | 'used' | 'expired'; left: number }) {
  const label = status === 'active' ? (left <= 1 ? 'Expires today' : `${left} days left`) : status === 'used' ? 'Used' : 'Expired';
  const urgent = status === 'active' && left <= 5;
  return <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', urgent ? 'bg-accent text-ink' : 'bg-white/20 text-white')}>{label}</span>;
}

/** Where a case should open, depending on how far it has got. */
export const caseHref = (id: string) => `/help/case/?id=${id}`;
