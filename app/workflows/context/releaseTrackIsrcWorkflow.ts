import { runReleaseTrackIsrcStep } from "./runReleaseTrackIsrcStep";

/** Durable entry for source-bound Spotify track observations. */
export async function releaseTrackIsrcWorkflow(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
) {
  "use workflow";
  return runReleaseTrackIsrcStep(actor, owner, requestId, subjectId);
}
