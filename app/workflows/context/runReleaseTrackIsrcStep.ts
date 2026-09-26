import { runRecordedReleaseTrackIsrcs } from "@/lib/context/planning/runRecordedReleaseTrackIsrcs";

/** A repeated step must reconcile its prior database attempt before calling Spotify again. */
export async function runReleaseTrackIsrcStep(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
) {
  "use step";
  return runRecordedReleaseTrackIsrcs(actor, owner, requestId, subjectId);
}
