import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Format check only (demo): two letters, six digits, A-D. Accepts HMRC's QQ 12 34 56 C example.
const NI_PATTERN = /^[A-Z]{2}\d{6}[A-D]$/;

export function normaliseNi(raw: string) {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/**
 * Demo sign-in: there is no real identity check. A valid-looking National
 * Insurance number + date of birth either finds or creates the person.
 */
export const signIn = mutation({
  args: { niNumber: v.string(), firstName: v.string(), dateOfBirth: v.string() },
  handler: async (ctx, args) => {
    const niNumber = normaliseNi(args.niNumber);
    if (!NI_PATTERN.test(niNumber)) {
      throw new ConvexError('That doesn’t look like a National Insurance number. It should look like QQ 12 34 56 C.');
    }
    const firstName = args.firstName.trim();
    if (!firstName) throw new ConvexError('Please tell us your first name.');

    const existing = await ctx.db
      .query('users')
      .withIndex('by_ni', (q) => q.eq('niNumber', niNumber))
      .unique();

    if (existing) {
      if (existing.dateOfBirth !== args.dateOfBirth) {
        throw new ConvexError('Those details don’t match our records. Check your date of birth.');
      }
      if (existing.firstName !== firstName) await ctx.db.patch(existing._id, { firstName });
      return existing._id;
    }

    return await ctx.db.insert('users', {
      niNumber,
      firstName,
      dateOfBirth: args.dateOfBirth,
      createdAt: Date.now(),
    });
  },
});

export const me = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      firstName: user.firstName,
      maskedNi: `${user.niNumber.slice(0, 2)} •• •• ${user.niNumber.slice(6, 8)} ${user.niNumber.slice(8)}`,
    };
  },
});
