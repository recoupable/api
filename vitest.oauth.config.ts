import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
  test: {
    include: [
      "scripts/mcp-oauth/**/*.test.ts",
      "lib/oauth/**/*.test.ts",
      "lib/mcp/oauth/**/*.test.ts",
      "lib/privy/__tests__/getVerifiedOAuthIdentity.test.ts",
      "lib/supabase/oauth_account_identities/**/*.test.ts",
      "lib/supabase/oauth_provider_artifacts/**/*.test.ts",
      "lib/supabase/oauth_rate_limits/**/*.test.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
