import { runContextStep } from "./runContextStep";
import { recordContextPlanStep } from "./recordContextPlanStep";
/** Durable workflow for one saved context request. */
export async function contextWorkflow(actor: string, owner: string, requestId: string) {
  "use workflow";
  const request = await runContextStep(actor, owner, requestId);
  await recordContextPlanStep(actor, owner, requestId);
  return request;
}
