/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  // Tell Next.js not to bundle pdf-parse (it's server‑side only)
  serverExternalPackages: ['pdf-parse'],

  webpack: (config, { isServer }) => {
    // Only apply this rule on the server build
    if (isServer) {
      config.module.rules.push({
        test: /\.node$/, // match .node files
        use: 'raw-loader', // load them as raw text/binary
      });
    }
    return config;
  },
};

export default nextConfig;
