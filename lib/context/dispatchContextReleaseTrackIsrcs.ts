import { start } from "workflow/api";
import { releaseTrackIsrcWorkflow } from "@/app/workflows/context/releaseTrackIsrcWorkflow";

/** Queue the guarded track lookup; the workflow step owns provider work. */
export async function dispatchContextReleaseTrackIsrcs(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
) {
  return start(releaseTrackIsrcWorkflow, [actor, owner, requestId, subjectId]);
}
