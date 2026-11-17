import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { denyNetwork } from "../pack-scheduler-workflow-fixture/denyNetwork.mjs";
import { buildFixture } from "./buildFixture.mjs";
import { runWorker } from "./runWorker.mjs";
import { runScenario } from "./runScenario.mjs";
const networkAttempts = denyNetwork();
// Satisfy the const-module import guard with a synthetic sentinel; never read credentials.
process.env.PRIVY_PROJECT_SECRET = "offline-fixture-not-a-credential";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
if (process.argv[2] === "worker")
  await runWorker(process.argv[3], process.argv[4], process.argv[5], networkAttempts);
else {
  const temp = await realpath(await mkdtemp(join(tmpdir(), "pack-foundation-workflow-")));
  try {
    const build = await buildFixture(root, here, temp);
    const results = [];
    for (const scenario of [
      "success",
      "retained",
      "failed",
      "uncertain",
      "none_requested",
      "missing",
      "persistence-ack-loss",
    ]) {
      results.push(await runScenario(root, here, temp, scenario));
      console.log(
        `PASS ${scenario}: ${scenario === "persistence-ack-loss" ? "failed acknowledgement" : "persisted readiness barrier"}, restart and terminal replay`,
      );
    }
    assert.equal(networkAttempts(), 0);
    if (process.env.PACK_FOUNDATION_OUTPUT)
      await writeFile(
        process.env.PACK_FOUNDATION_OUTPUT,
        JSON.stringify(
          {
            ...build,
            networkAttempts: networkAttempts(),
            results,
            limits:
              "Local compiled orchestration and typed synthetic steps. Explicit reenqueue after owned SIGKILL at journaled readiness suspension. No hosted recovery, database, provider, mid-effect crash or production activation proof.",
          },
          null,
          2,
        ),
      );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
