'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'remedy' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  remedy: 'bg-remedy text-white hover:bg-[#101726]',
  secondary: 'bg-brand-soft text-brand hover:bg-[#e1ece6]',
  outline: 'border border-line bg-surface text-ink hover:border-faint hover:bg-bg',
  ghost: 'text-muted hover:bg-line/40 hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
};

export function Button({
  variant = 'primary',
  icon: Icon,
  loading,
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-5 text-sm' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'primary', icon: Icon, size = 'md', className, children }: {
  href: string;
  variant?: Variant;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-12 px-5 text-sm' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}>
      {children}
      {Icon ? <Icon className="size-4" /> : null}
    </Link>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const base = 'rounded-xl border border-line bg-surface p-5';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(base, 'block w-full text-left transition-colors hover:border-faint', className)}>
        {children}
      </button>
    );
  }
  return <div className={cx(base, className)}>{children}</div>;
}

const TONES = {
  info: { cls: 'border-l-2 border-info bg-info-soft/60 text-ink', iconCls: 'text-info', icon: Info },
  warn: { cls: 'border-l-2 border-warn bg-warn-soft/60 text-ink', iconCls: 'text-warn', icon: TriangleAlert },
  danger: { cls: 'border-l-2 border-danger bg-danger-soft/60 text-ink', iconCls: 'text-danger', icon: AlertCircle },
  success: { cls: 'border-l-2 border-brand bg-brand-soft/60 text-ink', iconCls: 'text-brand', icon: CheckCircle2 },
} as const;

export function Banner({ tone = 'info', title, icon, children, className }: {
  tone?: keyof typeof TONES;
  title?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = icon ?? t.icon;
  return (
    <div className={cx('flex gap-3 rounded-r-lg px-4 py-3 text-sm', t.cls, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className={cx('mt-0.5 size-4 shrink-0', t.iconCls)} />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className="text-muted">{children}</div> : null}
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'muted', className }: {
  children: ReactNode;
  tone?: 'brand' | 'info' | 'warn' | 'danger' | 'muted' | 'remedy';
  icon?: LucideIcon;
  className?: string;
}) {
  const dot = {
    brand: 'bg-brand',
    info: 'bg-info',
    warn: 'bg-warn',
    danger: 'bg-danger',
    muted: 'bg-faint',
    remedy: 'bg-remedy',
  }[tone];
  const text = {
    brand: 'text-brand',
    info: 'text-info',
    warn: 'text-warn',
    danger: 'text-danger',
    muted: 'text-muted',
    remedy: 'text-remedy',
  }[tone];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', text, className)}>
      <span className={cx('size-1.5 rounded-full', dot)} />
      {children}
    </span>
  );
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-2.5 py-16 text-muted', className)}>
      <Loader2 className="size-5 animate-spin text-ink" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, 'h-10', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'min-h-28 py-2.5 leading-relaxed', className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Check({ label, hint, checked, onChange }: { label: ReactNode; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-ink)]" />
      <span className="space-y-0.5">
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        selected ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted hover:border-faint hover:text-ink',
      )}>
      {children}
    </button>
  );
}

export function Option({ label, hint, selected, multi, onClick }: { label: string; hint?: string; selected: boolean; multi?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
        selected ? 'border-ink bg-surface' : 'border-line bg-surface hover:border-faint',
      )}>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      <span
        className={cx(
          'flex size-4 shrink-0 items-center justify-center border text-[10px] text-white',
          multi ? 'rounded-xs' : 'rounded-full',
          selected ? 'border-ink bg-ink' : 'border-faint',
        )}>
        {selected ? '✓' : null}
      </span>
    </button>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1 overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full bg-ink transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'danger' | 'warn' | 'brand' }) {
  return (
    <div className="border-l border-line pl-4">
      <p className={cx('font-serif text-3xl font-medium tracking-tight tabular-nums', tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'brand' ? 'text-brand' : 'text-ink')}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function Empty({ title, text, children }: { icon?: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{text}</p>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[11px] font-medium uppercase tracking-wider text-muted', className)}>{children}</p>;
}
