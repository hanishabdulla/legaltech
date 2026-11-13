import { ConvexError } from 'convex/values';

export const money = (pence: number) =>
  pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;

export const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const daysLeft = (expiresAt: number, now = Date.now()) =>
  Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));

export const groupCode = (code: string) => code.replace(/(.{4})/g, '$1 ').trim();

export type VoucherStatus = 'active' | 'used' | 'expired';
export const voucherStatus = (v: { expiresAt: number; usedAt?: number }, now = Date.now()): VoucherStatus =>
  v.usedAt ? 'used' : v.expiresAt < now ? 'expired' : 'active';

export function errorMessage(err: unknown) {
  if (err instanceof ConvexError) return String(err.data);
  return 'Something went wrong. Please check your connection and try again.';
}
