/* eslint-disable unicorn/prefer-module */
// eslint-disable-next-line no-undef, @typescript-eslint/no-var-requires
const webpack = require("webpack");

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
    domains: ["raw.githubusercontent.com"],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // eslint-disable-next-line no-undef
        stream: require.resolve("stream-browserify"),
        // eslint-disable-next-line no-undef
        crypto: require.resolve("crypto-browserify"),
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          process: "process/browser",
        }),
        new webpack.NormalModuleReplacementPlugin(/node:crypto/, resource => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};

// eslint-disable-next-line no-undef
module.exports = nextConfig;