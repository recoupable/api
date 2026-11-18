import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
export default defineConfig({
  root,
  envDir: false,
  resolve: { alias: { "@": root } },
  test: {
    include: ["scripts/application-registration-proposal/sql-composition/qualification.test.ts"],
    setupFiles: ["scripts/application-registration-proposal/setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        execArgv: ["--import", fileURLToPath(new URL("./socket-guard.mjs", import.meta.url))],
      },
    },
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
