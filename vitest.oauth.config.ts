import { defineConfig } from "vitest/config";

export default defineConfig({
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
