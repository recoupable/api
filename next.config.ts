import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    RESOURCE_WALLET_ADDRESS: process.env.RESOURCE_WALLET_ADDRESS,
  },
  experimental: {
    optimizePackageImports: [
      'date-fns',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai',
      '@ai-sdk/google',
    ],
  },
};

export default nextConfig;
