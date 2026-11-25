import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // The OAuth provider requires Node 22 LTS; its HTTP lab has a dedicated CI job.
    exclude: [
      ...configDefaults.exclude,
      ".mcp-skills/**",
      // Requires explicit no-dotenv/no-network qualification before auth imports.
      "lib/applications/proposedRegistration/**",
      // Requires its explicit owned disposable PostgreSQL supervisor.
      "scripts/application-registration-proposal/sql-composition/**",
      "scripts/mcp-oauth/**",
      // This fixture owns node:test lifecycle cases and a separate compiled runtime runner.
      "scripts/pack-scheduler-workflow-fixture/**",
      "scripts/pack-foundation-workflow-fixture/**",
      "scripts/pack-admission-workflow-fixture/**",
    ],
    env: {
      PRIVY_PROJECT_SECRET: "test-secret",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
