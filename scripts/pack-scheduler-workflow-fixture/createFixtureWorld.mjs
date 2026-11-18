import { observeFailureDelivery } from "./observeFailureDelivery.mjs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
export async function createFixtureWorld(temp, effects) {
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
  await world.start();
  const { packSchedulerFixture } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  return {
    world,
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
