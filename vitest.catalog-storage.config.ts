import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["scripts/catalog-storage-integration/adapter.integration.ts"],
      fileParallelism: false,
      testTimeout: 30000,
    },
  }),
);
