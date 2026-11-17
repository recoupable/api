import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor } from "../packTypes";
/** Existing RPC owns account/org authorization; this read never establishes or repairs admission. */
export async function readAdmittedPackSnapshot(
  actor: PackActor,
  jobId: string,
  workflowRunId: string,
) {
  const saved = await runPackCommand(actor, "read", jobId);
  if (
    !workflowRunId ||
    saved.job.id !== jobId ||
    saved.job.owner_id.toLowerCase() !== (actor.organizationId ?? actor.accountId).toLowerCase() ||
    saved.job.status !== "running" ||
    saved.job.workflow_run_id !== workflowRunId
  )
    throw new Error(
      "Foundation requires this already-admitted running workflow; reconcile saved dispatch state",
    );
  return saved;
}
