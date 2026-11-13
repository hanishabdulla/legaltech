import { ConvexError } from 'convex/values';

export const money = (pence: number) => (pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`);

export const longDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const daysLeft = (expiresAt: number, now = Date.now()) => Math.max(0, Math.ceil((expiresAt - now) / 86_400_000));
export const groupCode = (code: string) => code.replace(/(.{4})/g, '$1 ').trim();

export type VoucherStatus = 'active' | 'used' | 'expired';
export const voucherStatus = (v: { expiresAt: number; usedAt?: number }, now = Date.now()): VoucherStatus =>
  v.usedAt ? 'used' : v.expiresAt < now ? 'expired' : 'active';

export function errorMessage(err: unknown) {
  if (err instanceof ConvexError) return String(err.data);
  return 'Something went wrong. Please check your connection and try again.';
}

export function dueLabel(dueAt: number | undefined, now: number) {
  if (!dueAt) return null;
  const diff = dueAt - now;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
  return { overdue: diff < 0, text: diff < 0 ? `Overdue by ${span}` : `Due in ${span}` };
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
