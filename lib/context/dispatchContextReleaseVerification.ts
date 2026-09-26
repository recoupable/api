import { start } from "workflow/api";
import { releaseVerificationWorkflow } from "@/app/workflows/context/releaseVerificationWorkflow";

/** Queue only the dedicated album verification workflow. The database fences repeat delivery. */
export async function dispatchContextReleaseVerification(
  actor: string,
  owner: string,
  requestId: string,
) {
  return start(releaseVerificationWorkflow, [actor, owner, requestId]);
}
