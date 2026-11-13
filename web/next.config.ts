import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static site: every page is a client app talking to Convex directly.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    // The repo root, so the site can import the shared Convex API from ../convex.
    root: path.join(__dirname, '..'),
    // Files in ../convex import `convex/*`. Resolve those from web/node_modules,
    // so the build works when only web/ is installed (e.g. on Vercel).
    resolveAlias: {
      'convex/server': './node_modules/convex/dist/esm/server/index.js',
      'convex/values': './node_modules/convex/dist/esm/values/index.js',
    },
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
