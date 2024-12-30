/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
      {
        hostname: 'dam.malt.com',
      },
    ],
  },
};

export default nextConfig;