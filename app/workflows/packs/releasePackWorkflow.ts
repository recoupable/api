import { preparePackStep } from "./preparePackStep";
import { producePackAssetStep } from "./producePackAssetStep";
import { settlePackStep } from "./settlePackStep";
import type { PackActor } from "@/lib/content/packs/packTypes";
/** First reviewed piece is delivered as soon as ready; the approved batch then continues automatically. */
export async function releasePackWorkflow(
  actor: PackActor,
  jobId: string,
  resumedAssetId?: string,
) {
  "use workflow";
  try {
    const prepared = await preparePackStep(actor, jobId);
    if (resumedAssetId) await producePackAssetStep(actor, prepared.job, resumedAssetId, true);
    else
      for (const assetId of prepared.assetIds)
        await producePackAssetStep(actor, prepared.job, assetId);
    await settlePackStep(actor, jobId);
    return { job_id: jobId };
  } catch (error) {
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
}
