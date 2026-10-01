import { ensureSiteExistsStep } from "./ensureSiteExistsStep";
import { initializeBuildStep } from "./initializeBuildStep";
import { buildTurnStep } from "./buildTurnStep";
/** Workflow-level loop: each completed model turn is persisted independently. */
export async function buildStep(...args: Parameters<typeof initializeBuildStep>) {
  let state = await initializeBuildStep(...args);
  while (!state.snapshot) {
    await ensureSiteExistsStep(args[0].id);
    state = await buildTurnStep(state, args[4]);
  }
  return state.snapshot;
}
