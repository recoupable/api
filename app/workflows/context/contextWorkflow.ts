import { runContextStep } from "./runContextStep";
import { recordContextPlanStep } from "./recordContextPlanStep";
/** Durable workflow for one saved context request. */
export async function contextWorkflow(actor: string, owner: string, requestId: string) {
  "use workflow";
  const request = await runContextStep(actor, owner, requestId);
  // A cancelled request has nothing to plan; end the run with its saved state.
  if ((request as { status?: string } | null)?.status !== "cancelled")
    await recordContextPlanStep(actor, owner, requestId);
  return request;
}
