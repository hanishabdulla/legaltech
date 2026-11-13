import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

/**
 * Demo seed for MVP 2: panel firms + the legislation corpus.
 *   npx convex run seed:run
 * Business, lawyer and firm users are created by signing in on each screen.
 */
export const run = internalAction({
  args: {},
  handler: async (ctx): Promise<{ firms: { created: number }; legislation: { act: string; official: number; fixtures: number }[] }> => {
    const firms = await ctx.runMutation(internal.firms.seedPanel, {});
    const legislation = await ctx.runAction(internal.legislation.ingestAll, {});
    return { firms, legislation };
  },
});
