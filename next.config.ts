import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  env: {
    RESOURCE_WALLET_ADDRESS: process.env.RESOURCE_WALLET_ADDRESS,
  },
  experimental: {
    optimizePackageImports: ["date-fns", "@ai-sdk/anthropic", "@ai-sdk/openai", "@ai-sdk/google"],
  },
  // Build type-checks app code only. Next 16.3 switched to the project-local
  // `tsc` CLI, which checks everything the tsconfig selects (tests included);
  // 16.0's checker did not. See the comment in tsconfig.build.json.
  typescript: {
    tsconfigPath: "tsconfig.build.json",
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
