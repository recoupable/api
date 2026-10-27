import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../../vitest.config";
import pins from "./sources.json";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cache = new Map(
  Object.entries(pins.api_files).map(([path, expected]) => {
    const filename = resolve(root, path);
    const bytes = readFileSync(filename);
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error(`API source pin mismatch: ${path}`);
    return [filename, bytes.toString("utf8")];
  }),
);
const loaded = new Set<string>();
export default mergeConfig(
  base,
  defineConfig({
    plugins: [
      {
        name: "frozen-application-proof-sources",
        enforce: "pre",
        load(id) {
          const filename = id.split("?")[0];
          const source = cache.get(filename);
          if (source !== undefined) {
            loaded.add(filename);
            return source;
          }
        },
        closeBundle() {
          if (loaded.size !== cache.size)
            throw new Error("Not every pinned API source was executed through the frozen loader");
        },
      },
    ],
    test: {
      include: [resolve(root, "scripts/application-proof/sql-bridge/bridge.integration.test.ts")],
    },
  }),
);
