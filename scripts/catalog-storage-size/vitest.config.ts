import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import pins from "./sources.json";
const root = fileURLToPath(new URL("../../", import.meta.url));
const cache = new Map(
  Object.entries(pins.api_files).map(([path, hash]) => {
    const file = resolve(root, path),
      bytes = readFileSync(file);
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error(`Source mismatch: ${path}`);
    return [file, bytes.toString("utf8")];
  }),
);
const seams = new Set(pins.synthetic_seams.map(p => resolve(root, p)));
const loaded = new Set<string>();
export default defineConfig({
  // Vite supports this inline option at runtime; its UserConfig omits the key.
  ...{ envFile: false as const },
  resolve: { alias: { "@": root } },
  plugins: [
    {
      name: "frozen-catalog-size",
      enforce: "pre",
      load(id) {
        const file = id.split("?")[0];
        if (file.startsWith(resolve(root, "lib") + "/") && !cache.has(file) && !seams.has(file))
          throw new Error(`Unpinned business import: ${file}`);
        if (seams.has(file)) throw new Error(`Synthetic seam original loaded: ${file}`);
        if (cache.has(file)) {
          loaded.add(file);
          return cache.get(file);
        }
      },
      closeBundle() {
        const missing = [...cache.keys()].filter(p => !loaded.has(p));
        writeFileSync(
          process.env.SITES_BRIDGE_LOAD_LOG!,
          JSON.stringify({ loaded: [...loaded].map(p => p.slice(root.length)), missing }, null, 2),
        );
        if (missing.length) throw new Error(`Pinned sources not loaded: ${missing.join(",")}`);
      },
    },
  ],
  test: {
    include: [
      resolve(root, "scripts/catalog-storage-size/size.integration.test.ts"),
      resolve(root, "scripts/catalog-storage-size/transportSafety.test.ts"),
    ],
    setupFiles: [resolve(root, "scripts/sites-evidence-sql-bridge/network-deny.ts")],
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
  },
});
