import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readEvents as events } from "./readEvents.mjs";
import { waitFor } from "./waitFor.mjs";
export async function pauseWorker(ctx, effects, scenario, waitHook, getNetworkAttempts) {
  const { start, packSchedulerFixture } = ctx;
  const run = await start(packSchedulerFixture, [scenario, 2]);
  await writeFile(join(effects, "run.json"), JSON.stringify({ runId: run.runId }));
  await waitHook("asset-0");
  await waitHook("asset-1");
  await waitFor(
    async () =>
      ctx.counts().activeDeliveries === 0 &&
      ctx.counts().deliveries > 0 &&
      (await events(effects)).filter(e => e.action === "claim").length === 4,
  );
  const trace = await events(effects);
  assert.equal(trace.filter(e => e.action === "provider").length, 2);
  assert.equal(trace.filter(e => e.action === "shared-preparation").length, 1);
  assert.equal(trace.filter(e => e.action === "settle").length, 0);
  await writeFile(join(effects, "before-crash.json"), JSON.stringify(trace));
  assert.equal(getNetworkAttempts(), 0);
  await writeFile(
    join(effects, "ready.json"),
    JSON.stringify({ networkAttempts: getNetworkAttempts(), pid: process.pid }),
  );
  await new Promise(() => {}); // parent SIGKILLs only this owned fixture worker
}
