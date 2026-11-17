import { join } from "node:path";
import { createFixtureWorld } from "./createFixtureWorld.mjs";
import { waitFor } from "./waitFor.mjs";
import { pauseWorker } from "./pauseWorker.mjs";
import { resumeAssets } from "./resumeAssets.mjs";
import { verifyOutcome } from "./verifyOutcome.mjs";
export async function runWorker(temp, scenario, phase, getNetworkAttempts) {
  const effects = join(temp, scenario);
  const ctx = await createFixtureWorld(temp, effects);
  const waitHook = async id =>
    waitFor(async () => {
      try {
        return !!(await ctx.getHookByToken(`${scenario}:${id}`));
      } catch (error) {
        if (!ctx.isHookNotFound(error)) throw error;
        return false;
      }
    });
  const keepAlive = setInterval(() => {}, 1000);
  try {
    if (phase === "start") await pauseWorker(ctx, effects, scenario, waitHook, getNetworkAttempts);
    const { run, runId } = await resumeAssets(ctx, effects, scenario, waitHook);
    await verifyOutcome(ctx, effects, scenario, run, runId, getNetworkAttempts);
  } finally {
    clearInterval(keepAlive);
    await ctx.world.close();
  }
}
