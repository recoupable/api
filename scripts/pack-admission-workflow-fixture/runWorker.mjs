import assert from "node:assert/strict";
import { assertRecoveryTrace } from "./assertRecoveryTrace.mjs";
import { join } from "node:path";
import { writeFile, rename } from "node:fs/promises";
import { createAdmissionWorld } from "./createAdmissionWorld.mjs";
import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { readEvents } from "../pack-scheduler-workflow-fixture/readEvents.mjs";
import { waitFor } from "../pack-scheduler-workflow-fixture/waitFor.mjs";
import { readAdmissionJournal } from "./readAdmissionJournal.mjs";
import { readAdmissionResults } from "./readAdmissionResults.mjs";
import { writeAdmissionReceipt } from "./writeAdmissionReceipt.mjs";
import { assertOutcomeWithDiagnostics } from "./assertOutcomeWithDiagnostics.mjs";
export async function runWorker(temp, scenario, phase, attempts) {
  const effects = join(temp, scenario);
  const ctx = await createAdmissionWorld(temp, effects, phase);
  const onSnapshotRequest = message => {
    if (message?.type === "admission-snapshot")
      process.send?.({
        type: "admission-snapshot",
        requestId: message.requestId,
        evidence: {
          scenario,
          phase,
          deliveryContext: ctx.counts(),
          worldTrace: ctx.observer.snapshot(),
        },
      });
  };
  process.on("message", onSnapshotRequest);
  const keepAlive = setInterval(() => {}, 1000);
  const idle = () => ctx.counts().deliveries > 0 && ctx.counts().activeDeliveries === 0;
  const journal = runId => readAdmissionJournal(ctx.world, runId);
  const results = async runId => readAdmissionResults(await journal(runId), runId);
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
      const run = await ctx.observer.source("original-dispatch", () =>
        ctx.start(ctx.packSchedulerFixture, [scenario, 2]),
      );
      await writeFile(join(effects, "run.json"), JSON.stringify({ runId: run.runId }));
      await waitFor(
        async () =>
          idle() &&
          (["delayed", "deadline", "hold-expiry"].includes(scenario)
            ? (await journal(run.runId)).some(e => e.eventType === "wait_created")
            : await finished()),
      );
      await writeFile(
        join(effects, "start-clock.json"),
        JSON.stringify((await results(run.runId)).startClock),
      );
      const trace = await readEvents(effects);
      assert(trace.length >= 1 && trace.every(e => e.action === "read"));
      await writeFile(join(effects, "before-crash.json"), JSON.stringify(trace));
      await writeFile(
        join(effects, "initial-state.json"),
        JSON.stringify(await readJson(join(effects, "state.json"))),
      );
      assert.equal(attempts(), 0);
      await writeFile(
        join(effects, "before-crash-world-trace.json"),
        JSON.stringify(ctx.observer.snapshot()),
      );
      await ctx.observer.flush();
      await writeFile(join(effects, "ready.tmp"), JSON.stringify({ networkAttempts: attempts() }));
      await rename(join(effects, "ready.tmp"), join(effects, "ready.json"));
      await new Promise(() => {});
    }
    const { runId } = await readJson(join(effects, "run.json"));
    const run = ctx.getRun(runId);
    // createAdmissionWorld already starts SDK recovery for this persisted run.
    await waitFor(async () => idle() && (await finished()), 45000);
    await ctx.observer.source("finish-hook", () =>
      ctx.resumeHook(`${scenario}:finished`, "continue"),
    );
    const value = await run.returnValue;
    const trace = await readEvents(effects);
    const state = await readJson(join(effects, "state.json"));
    const initial = await readJson(join(effects, "initial-state.json"));
    const events = await journal(runId);
    const startClock = await readJson(join(effects, "start-clock.json"));
    const beforeCrash = await readJson(join(effects, "before-crash.json"));
    const evidence = {
      scenario,
      runId,
      state,
      initialState: initial,
      trace,
      journal: events,
      value,
      startClock,
      beforeCrash,
      deliveryContext: { phase, ...ctx.counts() },
      worldTrace: ctx.observer.snapshot(),
      beforeCrashWorldTrace: await readJson(join(effects, "before-crash-world-trace.json")),
    };
    // Save raw IDs/lifecycle before decoding or assertions; the parent retains failures in CI output.
    const diagnostic = join(effects, "assertion-evidence.json");
    await writeFile(diagnostic, JSON.stringify(evidence));
    const decoded = await readAdmissionResults(events, runId);
    evidence.observations = decoded.observations;
    evidence.decodedStartClock = decoded.startClock;
    await writeFile(diagnostic, JSON.stringify(evidence));
    assert.deepEqual(state, {
      ...initial,
      ...(scenario === "delayed" ? { savedRunId: runId } : {}),
    });
    assert.deepEqual(decoded.startClock, startClock);
    assert.deepEqual(trace.slice(0, beforeCrash.length), beforeCrash);
    // Fresh polls may already be due at restart. Exact step IDs distinguish them from replayed effects.
    assertOutcomeWithDiagnostics(evidence);
    const before = ctx.counts().deliveries;
    await ctx.observer.source("terminal-replay", () => ctx.reenqueueRun(ctx.world, runId));
    await waitFor(() => idle() && ctx.counts().deliveries > before);
    assert.deepEqual(await readEvents(effects), trace);
    assert.deepEqual(await readJson(join(effects, "state.json")), state);
    assert.equal(attempts(), 0);
    assertRecoveryTrace(ctx.observer.snapshot(), runId);
    await writeAdmissionReceipt(effects, {
      scenario,
      runId,
      startClock,
      observations: decoded.observations,
      value,
      trace,
      state,
      journal: events,
      networkAttempts: attempts(),
      worldTrace: ctx.observer.snapshot(),
      beforeCrashWorldTrace: evidence.beforeCrashWorldTrace,
    });
    console.log(
      `PASS ${scenario}: ${value.status}, ${trace.length} read(s), restart and terminal replay`,
    );
  } finally {
    process.off("message", onSnapshotRequest);
    clearInterval(keepAlive);
    await ctx.world.close();
    await ctx.observer.flush();
  }
}
