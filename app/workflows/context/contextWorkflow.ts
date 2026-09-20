import { runContextStep } from "./runContextStep";
/** Durable workflow for one saved context request. */
export async function contextWorkflow(actor: string, owner: string, requestId: string) {
  "use workflow";
  return runContextStep(actor, owner, requestId);
}
