import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

/**
 * Demo identity. Clients get an anonymous random session token; staff sign in
 * with a demo code. Only a SHA-256 hash of each token is stored. Functions
 * take the token (a secret), never a user id, and derive identity from it.
 * The pilot replaces this with Convex Auth and ctx.auth.
 */

export async function sha256(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

type Ctx = QueryCtx | MutationCtx;

export async function getClient(ctx: Ctx, token: string): Promise<Doc<'clients'> | null> {
  if (!token) return null;
  const hash = await sha256(token);
  return await ctx.db
    .query('clients')
    .withIndex('by_sessionHash', (q) => q.eq('sessionHash', hash))
    .unique();
}

export async function requireClient(ctx: Ctx, token: string) {
  const client = await getClient(ctx, token);
  if (!client) throw new ConvexError('Your session has ended. Please start again.');
  return client;
}

export async function requireClientCase(ctx: Ctx, token: string, caseId: Id<'cases'>) {
  const client = await requireClient(ctx, token);
  const c = await ctx.db.get(caseId);
  if (!c || c.clientId !== client._id) throw new ConvexError('We couldn’t find that case.');
  return { client, case: c };
}

export async function getStaff(ctx: Ctx, token: string): Promise<Doc<'staff'> | null> {
  if (!token) return null;
  const hash = await sha256(token);
  const session = await ctx.db
    .query('staffSessions')
    .withIndex('by_sessionHash', (q) => q.eq('sessionHash', hash))
    .unique();
  return session ? await ctx.db.get(session.staffId) : null;
}

export type StaffRole = Doc<'staff'>['role'];
export const ADVISER_ROLES: StaffRole[] = ['adviser', 'supervisor', 'admin'];
export const LAWYER_ROLES: StaffRole[] = ['lawyer', 'admin'];
export const FIRM_ROLES: StaffRole[] = ['firm'];

/** Signed-in staff member with one of `roles` (MVP 1 advisers by default). */
export async function requireStaff(ctx: Ctx, token: string, roles: StaffRole[] = ADVISER_ROLES) {
  const staff = await getStaff(ctx, token);
  if (!staff || !roles.includes(staff.role)) {
    const who = roles.includes('lawyer') ? 'a Remedy lawyer' : roles.includes('firm') ? 'a partner firm' : 'an adviser';
    throw new ConvexError(`Please sign in as ${who}.`);
  }
  return staff;
}

// ---------- MVP 2: businesses ----------

export async function getBusiness(ctx: Ctx, token: string): Promise<Doc<'businesses'> | null> {
  if (!token) return null;
  const hash = await sha256(token);
  return await ctx.db
    .query('businesses')
    .withIndex('by_sessionHash', (q) => q.eq('sessionHash', hash))
    .unique();
}

export async function requireBusiness(ctx: Ctx, token: string) {
  const business = await getBusiness(ctx, token);
  if (!business) throw new ConvexError('Your session has ended. Please set up your business again.');
  return business;
}

export async function requireBusinessMatter(ctx: Ctx, token: string, matterId: Id<'matters'>) {
  const business = await requireBusiness(ctx, token);
  const matter = await ctx.db.get(matterId);
  if (!matter || matter.businessId !== business._id) throw new ConvexError('We couldn’t find that matter.');
  return { business, matter };
}

/** A firm user can only see referrals sent to their own firm. */
export async function requireFirmReferral(ctx: Ctx, token: string, referralId: Id<'firmReferrals'>) {
  const staff = await requireStaff(ctx, token, FIRM_ROLES);
  const referral = await ctx.db.get(referralId);
  if (!referral || !staff.firmId || referral.firmId !== staff.firmId) throw new ConvexError('We couldn’t find that referral.');
  return { staff, referral };
}

export async function audit(
  ctx: MutationCtx,
  entry: { caseId?: Id<'cases'>; matterId?: Id<'matters'>; actor: string; event: string; detail?: unknown },
) {
  await ctx.db.insert('auditLog', { ...entry, detail: entry.detail ?? null, at: Date.now() });
}
