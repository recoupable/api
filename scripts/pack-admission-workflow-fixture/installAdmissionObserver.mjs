import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const local = createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local");
const sdk = JSON.parse(readFileSync(join(dirname(local), "../package.json"), "utf8"));
assert.equal(sdk.version, "4.1.1");
globalThis[Symbol.for("pack.admission.sdk")] = {
  worldLocal: sdk.version,
  queueSha256: "0a22ec456650db6acfaf877856520eafa835b149759295aa9c8736396e67a012",
};
const queueUrl = pathToFileURL(join(dirname(local), "queue.js")).href;
const key = Symbol.for("pack.admission.queue.observers");
globalThis[key] ??= new Map();
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== queueUrl) return loaded;
    const source = String(loaded.source);
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      "0a22ec456650db6acfaf877856520eafa835b149759295aa9c8736396e67a012",
    );
    const needle = "        queue,\n";
    assert.equal(source.split(needle).length, 2);
    return {
      ...loaded,
      source: source.replace(
        needle,
        `        queue: (...args) => {
            const observer = globalThis[Symbol.for("pack.admission.queue.observers")]?.get(config.dataDir);
            return observer ? observer(queue, args) : queue(...args);
        },\n`,
      ),
    };
  },
});
