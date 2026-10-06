import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/mcp-oauth/**/*.test.ts",
      "lib/oauth/**/*.test.ts",
      "lib/supabase/oauth_provider_artifacts/**/*.test.ts",
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
