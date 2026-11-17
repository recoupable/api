import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readJson } from "./readJson.mjs";
import { readEvents as events } from "./readEvents.mjs";
import { waitFor } from "./waitFor.mjs";
export async function verifyOutcome(ctx, effects, scenario, run, runId, getNetworkAttempts) {
  const { reenqueueRun, world } = ctx;
  let value;
  let failure;
  try {
    value = await run.returnValue;
  } catch (error) {
    failure = String(error);
  }
  const trace = await events(effects);
  const state = await readJson(join(effects, "state.json"));
  assert.equal(trace.filter(e => e.action === "shared-preparation").length, 1);
  assert.equal(state.job.held_credits, 100);
  assert.equal(state.job.workflow_run_id, runId);
  assert.equal(state.assets[4].status, "completed");
  assert.deepEqual(state.assets[4].files, [
    { storage_key: "retained", content_type: "image/png", bytes: 10 },
  ]);
  assert(state.assets.every(a => a.attempt <= 1));
  assert.equal(
    new Set(trace.filter(e => e.action === "provider").map(e => e.data.assetId)).size,
    trace.filter(e => e.action === "provider").length,
  );
  if (scenario === "claim-failure") {
    assert.equal(value.error, "Pack stopped; inspect saved status and outputs before retrying");
    assert.deepEqual(value.failed_asset_ids, ["asset-2"]);
    assert.equal(state.assets[2].status, "running");
    assert.equal(state.assets[2].attempt, 1);
    assert.equal(trace.filter(e => e.action === "provider").length, 2);
    assert.equal(state.assets[3].status, "pending");
  } else if (scenario === "success") {
    assert.deepEqual(value, { job_id: scenario });
    assert.equal(trace.filter(e => e.action === "provider").length, 4);
  }
  if (scenario === "composition-failure") {
    assert.deepEqual(value, { job_id: scenario });
    assert.equal(state.assets[0].status, "failed");
    assert.deepEqual(state.assets[0].files, [
      { storage_key: "asset-0", content_type: "image/png", bytes: 10 },
    ]);
    assert.deepEqual(state.assets[0].files, state.assets[0].provider_state.composition.files);
    assert.equal(trace.filter(e => e.action === "provider").length, 4);
  }
  const before = ctx.counts().deliveries;
  await reenqueueRun(world, runId);
  await waitFor(async () => ctx.counts().deliveries > before);
  assert.deepEqual(await events(effects), trace);
  assert.equal(getNetworkAttempts(), 0);
  const result = {
    scenario,
    runId: runId,
    value,
    failure,
    settlements: state.settlements,
    networkAttempts: getNetworkAttempts(),
    trace,
    state,
    replay: "no repeated effects after process restart or terminal replay",
  };
  await writeFile(join(effects, "result.json"), JSON.stringify(result, null, 2));
  assert.equal(state.settlements, 1);
  if (scenario === "settlement-failure")
    assert(failure, "Lost settlement must remain failed, not success");
}
