import staticHosting from '@convex-dev/static-hosting/convex.config';
import { defineApp } from 'convex/server';

// The web app is served from the root of the deployment's .convex.site URL.
// Any HTTP actions we add later live under /api.
const app = defineApp({ httpPrefix: '/api' });
app.use(staticHosting, { httpPrefix: '/' });

export default app;
