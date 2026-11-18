import { assertPackExecutionIdentity } from "@/lib/content/packs/fence/assertPackExecutionIdentity";
import type { PackLaunchFence } from "@/lib/content/packs/fence/packFenceTypes";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
import { getWorkflowMetadata } from "workflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { preparePackProduction } from "@/lib/content/packs/preparePackProduction";
import type { PackActor } from "@/lib/content/packs/packTypes";
export async function preparePackStep(
  actor: PackActor,
  jobId: string,
  execution?: PackLaunchFence,
) {
  "use step";
  if (actor.packProtocol === 2 && !execution)
    throw new PackFenceError("Missing original launch identity");
  const workflowRunId = getWorkflowMetadata().workflowRunId;
  await runPackCommand(actor, "run", jobId, {
    ...execution,
    workflow_run_id: workflowRunId,
  });
  const saved = await runPackCommand(actor, "read", jobId);
  if (actor.packProtocol === 2) {
    assertPackExecutionIdentity(saved.job, execution, workflowRunId);
    if (saved.job.status !== "running") throw new PackFenceError("Pack no longer running");
  }
  const job = await preparePackProduction(actor, saved.job);
  return {
    job,
    assetIds: saved.assets.filter(a => a.status === "pending").map(a => a.id),
    ...(actor.packProtocol === 2
      ? { assetAttempts: Object.fromEntries(saved.assets.map(a => [a.id, a.attempt] as const)) }
      : {}),
  };
}
preparePackStep.maxRetries = 0;
