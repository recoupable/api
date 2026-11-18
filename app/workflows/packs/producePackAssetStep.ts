import { getWorkflowMetadata } from "workflow";
import { getPackExecutionFence } from "@/lib/content/packs/fence/getPackExecutionFence";
import { getPackAssetFence } from "@/lib/content/packs/fence/getPackAssetFence";
import { getPackClaimRequestId } from "@/lib/content/packs/fence/getPackClaimRequestId";
import { isPackFenceError } from "@/lib/content/packs/fence/isPackFenceError";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { producePackAsset } from "@/lib/content/packs/producePackAsset";
import { createPackProductionServices } from "@/lib/content/packs/createPackProductionServices";
import type { PackActor, PackJob } from "@/lib/content/packs/packTypes";
export async function producePackAssetStep(
  actor: PackActor,
  job: PackJob,
  assetId: string,
  resume = false,
  expectedAttempt?: number,
) {
  "use step";
  const fence = getPackExecutionFence(job);
  if (actor.packProtocol === 2 && job.workflow_run_id !== getWorkflowMetadata().workflowRunId)
    throw new PackFenceError("Actual workflow does not match original admission");
  if ((actor.packProtocol === 2) !== (job.protocol === 2))
    throw new PackFenceError("Pack protocol mismatch");
  if (actor.packProtocol === 2 && !Number.isInteger(expectedAttempt))
    throw new PackFenceError("Missing original pending attempt");
  const claim =
    resume && actor.packProtocol !== 2
      ? await runPackCommand(actor, "read", job.id)
      : await runPackCommand(actor, "claim", job.id, {
          ...fence,
          asset_id: assetId,
          ...(actor.packProtocol === 2
            ? {
                asset_attempt: expectedAttempt,
                request_id: getPackClaimRequestId(job.execution_id!, job.workflow_run_id!, assetId),
              }
            : {}),
        });
  if (actor.packProtocol === 2 && claim.replayed)
    throw new PackFenceError("Claim replay is reconciliation, not another production permit");
  const asset =
    resume && actor.packProtocol !== 2 ? claim.assets.find(a => a.id === assetId) : claim.asset;
  if (!asset || ((actor.packProtocol === 2 || !resume) && !claim.claimed)) return;
  try {
    await producePackAsset(job, asset, createPackProductionServices(actor, job, asset));
  } catch (error) {
    if (isPackFenceError(error)) throw error;
    const message = error instanceof Error ? error.message : "Asset generation failed";
    const uncertain = Object.entries(asset.provider_state).some(
      ([key, value]) =>
        key.includes("submission") && (value as { state?: string }).state !== "complete",
    );
    await runPackCommand(actor, "finish_asset", job.id, {
      ...getPackAssetFence(job, asset),
      asset_id: assetId,
      status: uncertain ? "uncertain" : "failed",
      files:
        (asset.provider_state.composition &&
          (asset.provider_state.composition as { files: unknown }).files) ||
        [],
      error: message,
    });
  }
}
producePackAssetStep.maxRetries = 0;
