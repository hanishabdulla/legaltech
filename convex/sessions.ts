import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { audit, getClient, getStaff, newToken, requireClient, sha256 } from './lib/auth';

export const CONSENT_VERSION = '2026-11-13';
export const STAFF_DEMO_CODE = 'LEEDS';
export const LANGUAGES = ['en', 'ur', 'pl', 'ar', 'ro', 'ku', 'pa'];

/** Starts an anonymous client session after they accept the privacy notice. */
export const startClient = mutation({
  args: { language: v.string() },
  handler: async (ctx, { language }) => {
    const token = newToken();
    await ctx.db.insert('clients', {
      sessionHash: await sha256(token),
      language: LANGUAGES.includes(language) ? language : 'en',
      consentAt: Date.now(),
      consentVersion: CONSENT_VERSION,
      createdAt: Date.now(),
    });
    return token;
  },
});

export const client = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const c = await getClient(ctx, token);
    return c ? { language: c.language, consentVersion: c.consentVersion } : null;
  },
});

export const setLanguage = mutation({
  args: { token: v.string(), language: v.string() },
  handler: async (ctx, { token, language }) => {
    const c = await requireClient(ctx, token);
    if (!LANGUAGES.includes(language)) throw new ConvexError('Language not supported yet.');
    await ctx.db.patch(c._id, { language });
  },
});

/** "Delete my data": removes the client and everything linked to them, including uploaded files. */
export const deleteMyData = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const client = await requireClient(ctx, token);
    const cases = await ctx.db.query('cases').withIndex('by_clientId', (q) => q.eq('clientId', client._id)).take(100);
    for (const c of cases) {
      const docs = await ctx.db.query('documents').withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(100);
      for (const d of docs) {
        await ctx.storage.delete(d.storageId);
        await ctx.db.delete(d._id);
      }
      for (const table of ['eligibility', 'referrals', 'actions', 'vouchers', 'auditLog'] as const) {
        const rows = await ctx.db.query(table).withIndex('by_caseId', (q) => q.eq('caseId', c._id)).take(500);
        for (const r of rows) await ctx.db.delete(r._id);
      }
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(client._id);
    await audit(ctx, { actor: 'system', event: 'client_data_deleted', detail: { cases: cases.length } });
  },
});

// ---------- Staff (demo sign-in; the pilot uses Convex Auth) ----------

export const staffSignIn = mutation({
  args: { name: v.string(), organisation: v.string(), code: v.string() },
  handler: async (ctx, { name, organisation, code }) => {
    if (code.trim().toUpperCase() !== STAFF_DEMO_CODE) throw new ConvexError('That access code isn’t right.');
    if (!name.trim()) throw new ConvexError('Please enter your name.');
    const staffId = await ctx.db.insert('staff', {
      name: name.trim().slice(0, 60),
      organisation: organisation.trim().slice(0, 80) || 'Leeds Citizens Advice',
      role: 'adviser',
      createdAt: Date.now(),
    });
    const token = newToken();
    await ctx.db.insert('staffSessions', { staffId, sessionHash: await sha256(token), createdAt: Date.now() });
    await audit(ctx, { actor: `staff:${staffId}`, event: 'staff_signed_in' });
    return token;
  },
});

export const staffMe = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await getStaff(ctx, token);
    return s ? { _id: s._id, name: s.name, organisation: s.organisation, role: s.role } : null;
  },
});

export const staffSignOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const hash = await sha256(token);
    const session = await ctx.db.query('staffSessions').withIndex('by_sessionHash', (q) => q.eq('sessionHash', hash)).unique();
    if (session) await ctx.db.delete(session._id);
  },
});

// ---------- MVP 2: Remedy lawyer and partner-firm sign-in (demo) ----------

export const REMEDY_DEMO_CODE = 'REMEDY';

export const remedyStaffSignIn = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    role: v.union(v.literal('lawyer'), v.literal('firm')),
    firmId: v.optional(v.id('partnerFirms')),
  },
  handler: async (ctx, { name, code, role, firmId }) => {
    if (code.trim().toUpperCase() !== REMEDY_DEMO_CODE) throw new ConvexError('That access code isn’t right.');
    if (!name.trim()) throw new ConvexError('Please enter your name.');
    let organisation = 'Remedy';
    if (role === 'firm') {
      const firm = firmId ? await ctx.db.get(firmId) : null;
      if (!firm || !firm.active) throw new ConvexError('Please choose your firm.');
      organisation = firm.name;
    }
    const staffId = await ctx.db.insert('staff', {
      name: name.trim().slice(0, 60),
      organisation,
      role,
      firmId: role === 'firm' ? firmId : undefined,
      createdAt: Date.now(),
    });
    const token = newToken();
    await ctx.db.insert('staffSessions', { staffId, sessionHash: await sha256(token), createdAt: Date.now() });
    await audit(ctx, { actor: `staff:${staffId}`, event: 'staff_signed_in', detail: { role } });
    return token;
  },
});
