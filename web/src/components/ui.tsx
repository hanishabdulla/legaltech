'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'remedy' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  remedy: 'bg-remedy text-white hover:bg-[#151d31]',
  secondary: 'bg-brand-soft text-brand hover:bg-[#d3e8dd]',
  outline: 'border border-line bg-surface text-ink hover:bg-bg',
  ghost: 'text-brand hover:bg-brand-soft',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-9 px-3 text-sm' : size === 'lg' ? 'h-14 px-6 text-base' : 'h-11 px-4 text-[15px]',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        size === 'sm' ? 'h-9 px-3 text-sm' : size === 'lg' ? 'h-14 px-6 text-base' : 'h-11 px-4 text-[15px]',
        VARIANTS[variant],
        className,
      )}>
      {children}
      {Icon ? <Icon className="size-4" /> : null}
    </Link>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const base = 'rounded-2xl border border-line bg-surface p-5';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(base, 'block w-full text-left transition hover:border-faint hover:shadow-sm', className)}>
        {children}
      </button>
    );
  }
  return <div className={cx(base, className)}>{children}</div>;
}

const TONES = {
  info: { cls: 'bg-info-soft text-info', icon: Info },
  warn: { cls: 'bg-warn-soft text-warn', icon: TriangleAlert },
  danger: { cls: 'bg-danger-soft text-danger', icon: AlertCircle },
  success: { cls: 'bg-brand-soft text-brand', icon: CheckCircle2 },
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
    <div className={cx('flex gap-3 rounded-xl p-4', t.cls, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm text-ink">{children}</div> : null}
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'muted', icon: Icon, className }: {
  children: ReactNode;
  tone?: 'brand' | 'info' | 'warn' | 'danger' | 'muted' | 'remedy';
  icon?: LucideIcon;
  className?: string;
}) {
  const cls = {
    brand: 'bg-brand-soft text-brand',
    info: 'bg-info-soft text-info',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
    muted: 'bg-[#eef0ee] text-muted',
    remedy: 'bg-remedy-soft text-remedy',
  }[tone];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', cls, className)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 py-16 text-muted', className)}>
      <Loader2 className="size-7 animate-spin text-brand" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border-[1.5px] border-line bg-surface px-4 text-[16px] text-ink placeholder:text-faint focus:border-brand focus:outline-none';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, 'h-12', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'min-h-28 py-3 leading-relaxed', className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="block">
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Check({ label, hint, checked, onChange }: { label: ReactNode; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]" />
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
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
        'rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors',
        selected ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:bg-brand-soft',
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
        'flex w-full items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-colors',
        selected ? 'border-brand bg-[#f2f9f5]' : 'border-line bg-surface hover:bg-[#f0f3ee]',
      )}>
      <span className="flex-1">
        <span className={cx('block font-semibold', selected && 'text-brand')}>{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      <span
        className={cx(
          'flex size-6 shrink-0 items-center justify-center border-2 text-white',
          multi ? 'rounded-md' : 'rounded-full',
          selected ? 'border-brand bg-brand' : 'border-[#c4ccc6]',
        )}>
        {selected ? '✓' : null}
      </span>
    </button>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'danger' | 'warn' | 'brand' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className={cx('text-2xl font-bold', tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : tone === 'brand' ? 'text-brand' : 'text-ink')}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-bg text-muted">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-xs font-bold uppercase tracking-wider text-muted', className)}>{children}</p>;
}
