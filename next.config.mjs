/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  // Enable experimental features for better performance
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@vercel/postgres'],
  },
  // Configure environment variables
  env: {
    POSTGRES_URL: process.env.POSTGRES_URL,
  },
};

export default nextConfig;
