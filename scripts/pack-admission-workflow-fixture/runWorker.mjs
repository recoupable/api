import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile, rename } from "node:fs/promises";
import { createFixtureWorld } from "../pack-scheduler-workflow-fixture/createFixtureWorld.mjs";
import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { readEvents } from "../pack-scheduler-workflow-fixture/readEvents.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
import { assertOutcome } from "./assertOutcome.mjs";
export async function runWorker(temp, scenario, phase, attempts) {
  const { hydrateStepReturnValue } = await import("@workflow/core/serialization");
  const effects = join(temp, scenario);
  const ctx = await createFixtureWorld(temp, effects);
  const keepAlive = setInterval(() => {}, 1000);
  const idle = () => ctx.counts().deliveries > 0 && ctx.counts().activeDeliveries === 0;
  const journal = async runId => {
    const events = [];
    let cursor;
    do {
      const page = await ctx.world.events.list({ runId, pagination: { sortOrder: "asc", cursor } });
      events.push(...page.data);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return events;
  };
  const readClock = async runId => {
    const events = await journal(runId);
    const created = events.find(
      e =>
        e.eventType === "step_created" && e.eventData.stepName.endsWith("//startPackAdmissionStep"),
    );
    const completed = events.find(
      e => e.eventType === "step_completed" && e.correlationId === created?.correlationId,
    );
    assert(completed, "start clock must be journaled before restart");
    return hydrateStepReturnValue(completed.eventData.result, runId, undefined);
  };
  const finished = async () => {
    try {
      return Boolean(await ctx.getHookByToken(`${scenario}:finished`));
    } catch (error) {
      if (!ctx.isHookNotFound(error)) throw error;
      return false;
    }
  };
  try {
    if (phase === "start") {
      const run = await ctx.start(ctx.packSchedulerFixture, [scenario, 2]);
      await writeFile(join(effects, "run.json"), JSON.stringify({ runId: run.runId }));
      await waitFor(
        async () =>
          idle() &&
          (["delayed", "deadline"].includes(scenario)
            ? (await journal(run.runId)).some(e => e.eventType === "wait_created")
            : await finished()),
      );
      await writeFile(
        join(effects, "start-clock.json"),
        JSON.stringify(await readClock(run.runId)),
      );
      const trace = await readEvents(effects);
      assert(trace.length >= 1 && trace.every(e => e.action === "read"));
      await writeFile(join(effects, "before-crash.json"), JSON.stringify(trace));
      await writeFile(
        join(effects, "initial-state.json"),
        JSON.stringify(await readJson(join(effects, "state.json"))),
      );
      assert.equal(attempts(), 0);
      await writeFile(join(effects, "ready.tmp"), JSON.stringify({ networkAttempts: attempts() }));
      await rename(join(effects, "ready.tmp"), join(effects, "ready.json"));
      await new Promise(() => {});
    }
    const { runId } = await readJson(join(effects, "run.json"));
    const run = ctx.getRun(runId);
    await ctx.reenqueueRun(ctx.world, runId);
    await waitFor(async () => idle() && (await finished()), 45000);
    await ctx.resumeHook(`${scenario}:finished`, "continue");
    const value = await run.returnValue;
    const trace = await readEvents(effects);
    const state = await readJson(join(effects, "state.json"));
    const initial = await readJson(join(effects, "initial-state.json"));
    assert.deepEqual(state, {
      ...initial,
      ...(scenario === "delayed" ? { savedRunId: runId } : {}),
    });
    const events = await journal(runId);
    const startClock = await readJson(join(effects, "start-clock.json"));
    assert.deepEqual(await readClock(runId), startClock);
    assertOutcome(scenario, runId, state, trace, events, value, startClock);
    const before = ctx.counts().deliveries;
    await ctx.reenqueueRun(ctx.world, runId);
    await waitFor(() => idle() && ctx.counts().deliveries > before);
    assert.deepEqual(await readEvents(effects), trace);
    assert.deepEqual(await readJson(join(effects, "state.json")), state);
    assert.equal(attempts(), 0);
    await writeFile(
      join(effects, "result.json"),
      JSON.stringify({
        scenario,
        runId,
        startClock,
        value,
        trace,
        state,
        journal: events.map(e => ({
          eventType: e.eventType,
          eventId: e.eventId,
          correlationId: e.correlationId,
          stepName: e.eventData?.stepName,
          resumeAt: e.eventData?.resumeAt,
        })),
        networkAttempts: attempts(),
        startCount: 1,
        replay:
          "Original start clock, distinct fresh read steps, no repeated read effects on terminal replay",
      }),
    );
    console.log(
      `PASS ${scenario}: ${value.status}, ${trace.length} read(s), restart and terminal replay`,
    );
  } finally {
    clearInterval(keepAlive);
    await ctx.world.close();
  }
}
