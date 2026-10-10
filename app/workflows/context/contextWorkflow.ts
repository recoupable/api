import { runContextStep } from "./runContextStep";
import { recordContextPlanStep } from "./recordContextPlanStep";
/** Durable workflow for one saved context request. */
export async function contextWorkflow(actor: string, owner: string, requestId: string) {
  "use workflow";
  const request = await runContextStep(actor, owner, requestId);
  // A failed request, such as a quarantined identity conflict, has no evidence to plan.
  if ((request as { status?: unknown } | null)?.status === "failed") return request;
  await recordContextPlanStep(actor, owner, requestId);
  return request;
}
