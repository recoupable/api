import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root,
  envDir: false,
  resolve: { alias: { "@": root } },
  test: {
    include: ["lib/applications/proposedRegistration/__tests__/*.test.ts"],
    setupFiles: ["scripts/application-registration-proposal/setup.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
