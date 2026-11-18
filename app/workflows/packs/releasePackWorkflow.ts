import type { PackLaunchFence } from "@/lib/content/packs/fence/packFenceTypes";
import { settleBoundedPackStep } from "./settleBoundedPackStep";
import { preparePackStep } from "./preparePackStep";
import { producePackAssetStep } from "./producePackAssetStep";
import { settlePackStep } from "./settlePackStep";
import type { PackActor } from "@/lib/content/packs/packTypes";
/** First reviewed piece is delivered as soon as ready; the approved batch then continues automatically. */
export async function releasePackWorkflow(
  actor: PackActor,
  jobId: string,
  resumedAssetId?: string,
  execution?: PackLaunchFence,
) {
  "use workflow";
  try {
    const prepared = await preparePackStep(actor, jobId, execution);
    if (resumedAssetId) {
      if (actor.packProtocol === 2)
        await producePackAssetStep(
          actor,
          prepared.job,
          resumedAssetId,
          true,
          prepared.assetAttempts?.[resumedAssetId],
        );
      else await producePackAssetStep(actor, prepared.job, resumedAssetId, true);
    } else
      for (const assetId of prepared.assetIds) {
        if (actor.packProtocol === 2)
          await producePackAssetStep(
            actor,
            prepared.job,
            assetId,
            false,
            prepared.assetAttempts?.[assetId],
          );
        else await producePackAssetStep(actor, prepared.job, assetId);
      }
    // Preserve the legacy workflow's existing settlement path. Protocol 2 does not retry an ambiguous settlement.
    if (actor.packProtocol !== 2) {
      await settlePackStep(actor, jobId);
      return { job_id: jobId };
    }
  } catch (error) {
    // Workflow SDK reconstructs terminal step errors as FatalError, losing custom names.
    // Any protocol-2 step rejection therefore stops without fallback settlement.
    if (actor.packProtocol === 2) throw error;
    await settlePackStep(
      actor,
      jobId,
      error instanceof Error ? error.message : "Pack workflow failed",
    );
    return {
      job_id: jobId,
      error: "Pack stopped; inspect saved status and outputs before retrying",
    };
  }
  await settleBoundedPackStep(actor, jobId, undefined, execution);
  return { job_id: jobId };
}
