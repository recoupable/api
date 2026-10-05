import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // The OAuth provider requires Node 22 LTS; its HTTP lab has a dedicated CI job.
    exclude: [...configDefaults.exclude, "scripts/mcp-oauth/**"],
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
