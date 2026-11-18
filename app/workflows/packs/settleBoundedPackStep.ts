import { getWorkflowMetadata } from "workflow";
import type { PackLaunchFence } from "@/lib/content/packs/fence/packFenceTypes";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor } from "@/lib/content/packs/packTypes";
/** Unwired scheduler adapter: an ambiguous settlement requires reconciliation, not retry. */
export async function settleBoundedPackStep(
  actor: PackActor,
  jobId: string,
  error?: string,
  execution?: PackLaunchFence,
) {
  "use step";
  if (actor.packProtocol === 2 && !execution)
    throw new PackFenceError("Missing original settlement identity");
  return runPackCommand(actor, "settle", jobId, {
    error: error ?? null,
    ...(execution ? { ...execution, workflow_run_id: getWorkflowMetadata().workflowRunId } : {}),
  });
}
settleBoundedPackStep.maxRetries = 0;
