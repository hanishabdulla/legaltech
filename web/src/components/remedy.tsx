'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Pill } from '@/components/ui';

/** Shared Remedy (MVP 2) pieces. */

export const FLAG_LABELS: Record<string, string> = {
  NEEDS_JUDGEMENT: 'Needs legal judgement',
  MISSING_FACTS: 'Missing facts',
  DEADLINE_RISK: 'Deadline risk',
  HIGH_VALUE: 'High value',
  RESERVED_ACTIVITY: 'Reserved activity',
  DOC_REVIEW: 'Document review',
  LOW_CONFIDENCE: 'Low confidence',
  OUT_OF_SCOPE: 'Out of scope',
};

export const TOPIC_LABELS: Record<string, string> = {
  employment: 'Employment',
  contracts: 'Contracts',
  data: 'Data',
  ip: 'IP',
  company: 'Company',
  property: 'Premises',
  consumer: 'Consumers',
  other: 'Other',
};

export const SECTORS = [
  { id: 'creative', label: 'Creative services' },
  { id: 'tech', label: 'Tech' },
  { id: 'retail', label: 'Retail' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'professional', label: 'Professional services' },
  { id: 'construction', label: 'Construction' },
  { id: 'health', label: 'Health' },
  { id: 'other', label: 'Other' },
];
export const sectorLabel = (id: string) => SECTORS.find((s) => s.id === id)?.label ?? id;

export const STAGES = [
  { id: 'idea', label: 'Idea', hint: 'Not trading yet' },
  { id: 'trading', label: 'Trading', hint: 'Selling to customers' },
  { id: 'raising', label: 'Raising', hint: 'Raising investment' },
] as const;
export type Stage = (typeof STAGES)[number]['id'];

export type MatterStatus = 'answering' | 'answered' | 'in_review' | 'awaiting_client' | 'lawyer_checked' | 'referral_suggested' | 'closed';

const STATUS: Record<MatterStatus, { label: string; tone: 'info' | 'warn' | 'danger' | 'brand' | 'remedy' | 'muted' }> = {
  answering: { label: 'Answering…', tone: 'info' },
  answered: { label: 'AI draft', tone: 'muted' },
  in_review: { label: 'Lawyer checking', tone: 'warn' },
  awaiting_client: { label: 'Needs your reply', tone: 'danger' },
  lawyer_checked: { label: 'Lawyer-checked', tone: 'brand' },
  referral_suggested: { label: 'Firm recommended', tone: 'remedy' },
  closed: { label: 'Closed', tone: 'muted' },
};

export function StatusBadge({ status, checkedBy }: { status: string; checkedBy?: string }) {
  const s = STATUS[status as MatterStatus] ?? STATUS.answered;
  return <Pill tone={s.tone}>{status === 'lawyer_checked' && checkedBy ? `Checked by ${checkedBy}` : s.label}</Pill>;
}

export function FlagChips({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <p className="text-xs text-muted">
      {codes.map((c) => FLAG_LABELS[c] ?? c).join(' · ')}
    </p>
  );
}

export type Citation = { act: string; section: string; url: string; heading?: string };
export const citeLabel = (c: { act: string; section: string }) =>
  c.act.startsWith('GOV.UK') ? `${c.act}: ${c.section}` : `${c.act}, ${c.act === 'UK GDPR' ? 'Art.' : 's.'}${c.section}`;

export function Citations({ citations, title = 'Sources' }: { citations: Citation[]; title?: string }) {
  if (!citations.length) return null;
  return (
    <div className="space-y-2 border-t border-line pt-4">
      <p className="text-[11px] font-medium tracking-wider text-muted uppercase">{title}</p>
      <div className="divide-y divide-line rounded-lg border border-line bg-bg/50">
        {citations.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener" className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-surface">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink">{citeLabel(c)}</span>
              {c.heading ? <span className="text-muted"> — {c.heading}</span> : null}
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-faint" />
          </a>
        ))}
      </div>
    </div>
  );
}

export const TRIGGER_LABEL: Record<string, string> = {
  traction: 'Growth',
  lawyer: 'Lawyer recommendation',
  reserved_activity: 'Reserved activity',
};

export const REFERRAL_STATUS: Record<string, { text: string; tone: 'info' | 'brand' | 'muted' | 'danger' }> = {
  sent: { text: 'New', tone: 'info' },
  accepted: { text: 'Accepted', tone: 'brand' },
  declined: { text: 'Declined', tone: 'muted' },
};

export const RISK = {
  high: { tone: 'danger', label: 'High risk', border: 'border-danger' },
  medium: { tone: 'warn', label: 'Review', border: 'border-warn' },
  low: { tone: 'brand', label: 'Standard', border: 'border-brand' },
} as const;

export function BusinessNotice() {
  return (
    <p className="text-xs text-muted">
      General information on the law of England and Wales, unless checked by a named Remedy lawyer.
    </p>
  );
}

/** Re-renders every `ms` so service-level timers stay current (Convex queries can't read the clock). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
