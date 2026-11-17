import assert from "node:assert/strict";
import { join } from "node:path";
import { readJson } from "./readJson.mjs";
import { readEvents as events } from "./readEvents.mjs";
import { waitFor } from "./waitFor.mjs";
export async function resumeAssets(ctx, effects, scenario, waitHook) {
  const { getRun, reenqueueRun, world, resumeHook } = ctx;
  const hook = id => `${scenario}:${id}`;
  console.log(`RESUME ${scenario}: local world ready`);
  const saved = await readJson(join(effects, "run.json"));
  const run = getRun(saved.runId);
  await reenqueueRun(world, saved.runId); // explicit local queue recovery, not hosted auto-recovery
  await waitFor(async () => ctx.counts().deliveries > 0);
  console.log(`RESUME ${scenario}: replay delivered`);
  await waitHook("asset-0");
  await waitHook("asset-1");
  assert.deepEqual(await events(effects), await readJson(join(effects, "before-crash.json")));
  console.log(`RESUME ${scenario}: hooks recovered`);
  await resumeHook(hook("asset-0"), "continue");
  if (scenario === "claim-failure") {
    await waitFor(async () =>
      (await events(effects)).some(e => e.action === "claim" && e.data.asset_id === "asset-2"),
    );
    assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
    await resumeHook(hook("asset-1"), "continue");
  } else {
    await waitFor(
      async () => (await events(effects)).filter(e => e.action === "provider").length === 3,
    );
    console.log(`RESUME ${scenario}: third asset ready`);
    assert.equal((await events(effects)).filter(e => e.action === "provider").length, 3);
    assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
    await resumeHook(hook("asset-1"), "continue");
    await waitFor(
      async () => (await events(effects)).filter(e => e.action === "provider").length === 4,
    );
    await resumeHook(hook("asset-2"), "continue");
    assert.equal((await events(effects)).filter(e => e.action === "settle").length, 0);
    await resumeHook(hook("asset-3"), "continue");
  }
  return { run, runId: saved.runId };
}
