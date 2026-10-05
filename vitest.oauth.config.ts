import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/mcp-oauth/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
