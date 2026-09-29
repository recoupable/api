import { initializeBuildStep } from "./initializeBuildStep";
import { buildTurnStep } from "./buildTurnStep";
/** Workflow-level loop: each completed model turn is persisted independently. */
export async function buildStep(...args: Parameters<typeof initializeBuildStep>) {
  let state = await initializeBuildStep(...args);
  while (!state.snapshot) state = await buildTurnStep(state, args[4]);
  return state.snapshot;
}
