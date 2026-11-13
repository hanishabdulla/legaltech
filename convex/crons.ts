import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Weekly legislation refresh (mvp2.md §6.1). Stores versionDate per section.
crons.cron('refresh legislation corpus', '0 3 * * 1', internal.legislation.ingestAll, {});

// Nightly traction rescoring (mvp2.md §6.5).
crons.cron('rescore traction', '30 2 * * *', internal.traction.scoreAll, {});

export default crons;
