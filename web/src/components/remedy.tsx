'use client';

import { BookOpen, Building2, CheckCheck, ExternalLink, Flag, Globe, Hourglass, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
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

const STATUS: Record<MatterStatus, { label: string; tone: 'info' | 'warn' | 'danger' | 'brand' | 'remedy' | 'muted'; icon: typeof Sparkles }> = {
  answering: { label: 'Answering…', tone: 'info', icon: Sparkles },
  answered: { label: 'AI answer', tone: 'info', icon: Sparkles },
  in_review: { label: 'Lawyer checking', tone: 'warn', icon: Hourglass },
  awaiting_client: { label: 'Lawyer needs info', tone: 'danger', icon: MessageCircle },
  lawyer_checked: { label: 'Lawyer-checked', tone: 'brand', icon: ShieldCheck },
  referral_suggested: { label: 'Firm recommended', tone: 'remedy', icon: Building2 },
  closed: { label: 'Closed', tone: 'muted', icon: CheckCheck },
};

export function StatusBadge({ status, checkedBy }: { status: string; checkedBy?: string }) {
  const s = STATUS[status as MatterStatus] ?? STATUS.answered;
  return <Pill tone={s.tone} icon={s.icon}>{status === 'lawyer_checked' && checkedBy ? `Lawyer-checked by ${checkedBy}` : s.label}</Pill>;
}

export function FlagChips({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((c) => (
        <Pill key={c} tone={c === 'DEADLINE_RISK' || c === 'RESERVED_ACTIVITY' ? 'danger' : 'warn'} icon={Flag}>{FLAG_LABELS[c] ?? c}</Pill>
      ))}
    </div>
  );
}

export type Citation = { act: string; section: string; url: string; heading?: string };
export const citeLabel = (c: { act: string; section: string }) =>
  c.act.startsWith('GOV.UK') ? `${c.act}: ${c.section}` : `${c.act}, ${c.act === 'UK GDPR' ? 'Art.' : 's.'}${c.section}`;

export function Citations({ citations, title = 'Legislation relied on' }: { citations: Citation[]; title?: string }) {
  if (!citations.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold tracking-wider text-muted uppercase">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {citations.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg bg-info-soft p-3 text-sm hover:ring-1 hover:ring-info">
            {c.act.startsWith('GOV.UK') ? <Globe className="size-4 shrink-0 text-info" /> : <BookOpen className="size-4 shrink-0 text-info" />}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-info">{citeLabel(c)}</span>
              {c.heading ? <span className="block truncate text-muted">{c.heading}</span> : null}
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-info" />
          </a>
        ))}
      </div>
    </div>
  );
}

export const TRIGGER_LABEL: Record<string, string> = {
  traction: 'Growth (traction score)',
  lawyer: 'Recommended by a Remedy lawyer',
  reserved_activity: 'Reserved legal activity',
};

export const REFERRAL_STATUS: Record<string, { text: string; tone: 'info' | 'brand' | 'muted' | 'danger' }> = {
  sent: { text: 'New', tone: 'info' },
  accepted: { text: 'Accepted', tone: 'brand' },
  declined: { text: 'Declined', tone: 'muted' },
};

export const RISK = {
  high: { tone: 'danger', label: 'Look closely', border: 'border-danger' },
  medium: { tone: 'warn', label: 'Worth checking', border: 'border-warn' },
  low: { tone: 'brand', label: 'Standard', border: 'border-brand' },
} as const;

export function BusinessNotice() {
  return (
    <p className="text-center text-sm text-muted">
      Remedy prototype. General information about the law in England and Wales, not legal advice, unless a named Remedy lawyer has checked it.
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
