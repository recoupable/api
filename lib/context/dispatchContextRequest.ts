import { start } from "workflow/api";
import { contextWorkflow } from "@/app/workflows/context/contextWorkflow";
/** Await dispatch acknowledgement; callers can retry the same saved request after a failure. */
export async function dispatchContextRequest(actor: string, owner: string, requestId: string) {
  return start(contextWorkflow, [actor, owner, requestId]);
}
