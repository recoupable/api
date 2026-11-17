/** Offline entry point; child processes install the same network deny boundary. */
import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { denyNetwork } from "./denyNetwork.mjs";
import { buildFixture } from "./buildFixture.mjs";
import { runScenario } from "./runScenario.mjs";
import { runWorker } from "./runWorker.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const getNetworkAttempts = denyNetwork();
if (process.argv[2] === "worker") {
  await runWorker(process.argv[3], process.argv[4], process.argv[5], getNetworkAttempts);
} else {
  const temp = await realpath(await mkdtemp(join(tmpdir(), "pack-scheduler-workflow-")));
  try {
    const { bindings, typecheck } = await buildFixture(root, here, temp);
    const results = [];
    for (const scenario of [
      "success",
      "claim-failure",
      "settlement-failure",
      "composition-failure",
    ]) {
      const result = await runScenario(root, here, temp, scenario);
      results.push(result);
      console.log(`PASS ${scenario}: restart/replay, ${result.settlements} settlement attempt(s)`);
    }
    assert.equal(getNetworkAttempts(), 0);
    assert(results.every(r => r.settlements === 1));
    const output = {
      bindings,
      typecheck,
      networkAttempts: getNetworkAttempts(),
      results,
      limits:
        "Local compiled scheduler/actual steps, synthetic effects, owned SIGKILL at journaled suspension. No hosted, SQL, live-provider or mid-provider crash proof.",
    };
    if (process.env.PACK_SCHEDULER_OUTPUT)
      await writeFile(process.env.PACK_SCHEDULER_OUTPUT, JSON.stringify(output, null, 2));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
