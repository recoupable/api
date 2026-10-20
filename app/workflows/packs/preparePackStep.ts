import { getWorkflowMetadata } from "workflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { preparePackProduction } from "@/lib/content/packs/preparePackProduction";
import type { PackActor } from "@/lib/content/packs/packTypes";
export async function preparePackStep(actor: PackActor, jobId: string) {
  "use step";
  await runPackCommand(actor, "run", jobId, {
    workflow_run_id: getWorkflowMetadata().workflowRunId,
  });
  const saved = await runPackCommand(actor, "read", jobId);
  const job = await preparePackProduction(actor, saved.job);
  return { job, assetIds: saved.assets.filter(a => a.status === "pending").map(a => a.id) };
}
preparePackStep.maxRetries = 0;
