import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile, rename } from "node:fs/promises";
import { createFixtureWorld } from "../pack-scheduler-workflow-fixture/createFixtureWorld.mjs";
import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { readEvents } from "../pack-scheduler-workflow-fixture/readEvents.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
import { assertOutcome } from "./assertOutcome.mjs";
export async function runWorker(temp, scenario, phase, networkAttempts) {
  const effects = join(temp, scenario);
  const ctx = await createFixtureWorld(temp, effects);
  const waitHook = token =>
    waitFor(async () => {
      try {
        return Boolean(await ctx.getHookByToken(`${scenario}:${token}`));
      } catch (error) {
        if (!ctx.isHookNotFound(error)) throw error;
        return false;
      }
    });
  const keepAlive = setInterval(() => {}, 1000);
  const waitIdle = () =>
    waitFor(async () => ctx.counts().deliveries > 0 && ctx.counts().activeDeliveries === 0);
  try {
    if (phase === "start") {
      const run = await ctx.start(ctx.packSchedulerFixture, [scenario, 2]);
      await writeFile(join(effects, "run.json"), JSON.stringify({ runId: run.runId }));
      await waitFor(async () =>
        (await readEvents(effects)).some(
          e => e.action === "persist" && e.result.state !== "pending",
        ),
      );
      await waitHook(scenario === "persistence-ack-loss" ? "finished" : "readiness");
      await waitIdle();
      const trace = await readEvents(effects);
      assert(!trace.some(e => e.action === "produce" && e.result.assetId !== "artwork-0"));
      assert(!trace.some(e => e.action === "settle"));
      await writeFile(join(effects, "before-crash.json"), JSON.stringify(trace));
      assert.equal(networkAttempts(), 0);
      await writeFile(
        join(effects, "ready.tmp"),
        JSON.stringify({ networkAttempts: networkAttempts(), pid: process.pid }),
      );
      await rename(join(effects, "ready.tmp"), join(effects, "ready.json"));
      await new Promise(() => {});
    }
    const { runId } = await readJson(join(effects, "run.json"));
    const run = ctx.getRun(runId);
    await ctx.reenqueueRun(ctx.world, runId);
    await waitIdle();
    assert.deepEqual(await readEvents(effects), await readJson(join(effects, "before-crash.json")));
    if (scenario !== "persistence-ack-loss")
      await ctx.resumeHook(`${scenario}:readiness`, "continue");
    await waitHook("finished");
    await waitIdle();
    await ctx.resumeHook(`${scenario}:finished`, "continue");
    const value = await run.returnValue;
    const trace = await readEvents(effects);
    const state = await readJson(join(effects, "state.json"));
    const initial = await readJson(join(effects, "initial.json"));
    assertOutcome(scenario, initial, state, trace, value);
    const before = ctx.counts().deliveries;
    await ctx.reenqueueRun(ctx.world, runId);
    await waitFor(
      async () => ctx.counts().deliveries > before && ctx.counts().activeDeliveries === 0,
    );
    assert.deepEqual(await readEvents(effects), trace);
    assert.deepEqual(await readJson(join(effects, "state.json")), state);
    assert.equal(networkAttempts(), 0);
    await writeFile(
      join(effects, "result.json"),
      JSON.stringify({
        scenario,
        runId,
        value,
        state,
        trace,
        networkAttempts: networkAttempts(),
        replay: "No repeated accepted effects after owned process restart and terminal replay",
      }),
    );
  } finally {
    clearInterval(keepAlive);
    await ctx.world.close();
  }
}
