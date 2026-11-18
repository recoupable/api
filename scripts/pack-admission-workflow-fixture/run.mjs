import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { denyNetwork } from "../pack-scheduler-workflow-fixture/denyNetwork.mjs";
import { buildFixture } from "./buildFixture.mjs";
import { runWorker } from "./runWorker.mjs";
import { runScenario } from "./runScenario.mjs";
const attempts = denyNetwork();
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
process.env.PACK_ADMISSION_SOURCE_HEAD ??= execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (process.argv[2] === "worker")
  await runWorker(process.argv[3], process.argv[4], process.argv[5], attempts);
else {
  const temp = await realpath(await mkdtemp(join(tmpdir(), "pack-admission-workflow-")));
  try {
    const build = await buildFixture(root, here, temp);
    const results = [];
    for (const scenario of [
      "immediate",
      "delayed",
      "deadline",
      "different-run",
      "read-failure",
      "expired-hold",
      "hold-expiry",
    ])
      results.push(await runScenario(root, here, temp, scenario));
    assert.equal(attempts(), 0);
    if (process.env.PACK_ADMISSION_OUTPUT)
      await writeFile(
        process.env.PACK_ADMISSION_OUTPUT,
        JSON.stringify(
          {
            ...build,
            results,
            networkAttempts: attempts(),
            scope:
              "Actual unwired admission coordinator and durable steps, synthetic read RPC. Local SIGKILL/restart and terminal replay; no hosted/database/provider execution or activation.",
          },
          null,
          2,
        ),
      );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
