import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.20.112.1', '192.168.1.171'],
  output: 'standalone',
  eslint: {
    // The ESLint toolchain needs migrating (eslint 8 vs eslint-config-next 16,
    // and `next lint` was removed in Next 16). Don't block production builds on
    // it; CI gates on typecheck + tests instead.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: [
    'pdf-parse',
    'playwright',
    'officeparser',
    'file-type',
  ],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
