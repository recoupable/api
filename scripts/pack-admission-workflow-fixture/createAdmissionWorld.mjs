import { observeFailureDelivery } from "../pack-scheduler-workflow-fixture/observeFailureDelivery.mjs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { observeAdmissionWorld } from "./observeAdmissionWorld.mjs";
const require = createRequire(import.meta.url);
export async function createAdmissionWorld(temp, effects, phase) {
  process.env.PACK_SCHEDULER_EFFECTS = effects;
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { HookNotFoundError } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/errors"))
  );
  const { setWorld, reenqueueRun } = await import("@workflow/core/runtime");
  const { start, getRun, resumeHook, getHookByToken } = await import("workflow/api");
  const world = createLocalWorld({ dataDir: join(effects, "journal") });
  const observer = observeAdmissionWorld(world, {
    phase,
    outputPath: join(effects, `${phase}-world-trace.jsonl`),
  });
  const observers = globalThis[Symbol.for("pack.admission.queue.observers")];
  if (!observers) throw new Error("Admission queue observer preload is required");
  observers.set(join(effects, "journal"), observer.observeQueue);
  const failureDelivery = observeFailureDelivery(world);
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  let deliveries = 0;
  let activeDeliveries = 0;
  world.registerHandler("__wkf_step_", steps.POST);
  world.registerHandler("__wkf_workflow_", async req => {
    activeDeliveries++;
    try {
      const response = await failureDelivery.deliver(workflows.POST, req);
      deliveries++;
      return response;
    } finally {
      activeDeliveries--;
    }
  });
  await observer.source("world.start", () => world.start());
  const { packSchedulerFixture } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  return {
    world,
    observer,
    isHookNotFound: HookNotFoundError.is,
    start,
    getRun,
    resumeHook,
    getHookByToken,
    reenqueueRun,
    packSchedulerFixture,
    hasObservedFailure: failureDelivery.hasObservedFailure,
    failureEvidence: failureDelivery.failureEvidence,
    counts: () => ({ deliveries, activeDeliveries }),
  };
}
