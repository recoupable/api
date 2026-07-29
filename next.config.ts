import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  env: {
    RESOURCE_WALLET_ADDRESS: process.env.RESOURCE_WALLET_ADDRESS,
  },
  // `@vercel/oidc` (pulled in by `@ai-sdk/gateway@4`) does a runtime
  // `require('./get-vercel-oidc-token.js')`. If bundled into the Workflow step
  // route, that relative require can't resolve at runtime and the build's
  // page-data collection throws. Keep the package external so Node resolves it
  // (and its internal require) natively. Requires `@vercel/oidc` as a direct
  // dependency so it's resolvable, and the webpack builder (Turbopack refuses
  // to externalize it).
  serverExternalPackages: ["@vercel/oidc"],
  experimental: {
    optimizePackageImports: ["date-fns", "@ai-sdk/anthropic", "@ai-sdk/openai", "@ai-sdk/google"],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With, x-api-key",
          },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
