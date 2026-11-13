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
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
