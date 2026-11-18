import { getWorkflowMetadata } from "workflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor } from "@/lib/content/packs/packTypes";
import type { PackAdmissionObservation } from "@/lib/content/packs/foundation/packAdmissionTypes";
export async function readPackAdmissionStep(
  actor: PackActor,
  jobId: string,
): Promise<PackAdmissionObservation> {
  "use step";
  const { job } = await runPackCommand(actor, "read", jobId);
  return {
    workflowRunId: getWorkflowMetadata().workflowRunId,
    observedAt: Date.now(),
    job: {
      id: job.id,
      owner_id: job.owner_id,
      status: job.status,
      workflow_run_id: job.workflow_run_id,
      hold_expires_at: job.hold_expires_at,
    },
  };
}
readPackAdmissionStep.maxRetries = 0;
