import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { producePackAsset } from "@/lib/content/packs/producePackAsset";
import { createPackProductionServices } from "@/lib/content/packs/createPackProductionServices";
import type { PackActor, PackJob } from "@/lib/content/packs/packTypes";
export async function producePackAssetStep(
  actor: PackActor,
  job: PackJob,
  assetId: string,
  resume = false,
) {
  "use step";
  const claim = resume
    ? await runPackCommand(actor, "read", job.id)
    : await runPackCommand(actor, "claim", job.id, { asset_id: assetId });
  const asset = resume ? claim.assets.find(a => a.id === assetId) : claim.asset;
  if (!asset || (!resume && !claim.claimed)) return;
  try {
    await producePackAsset(job, asset, createPackProductionServices(actor, job, asset));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset generation failed";
    const uncertain = Object.entries(asset.provider_state).some(
      ([key, value]) =>
        key.includes("submission") && (value as { state?: string }).state !== "complete",
    );
    await runPackCommand(actor, "finish_asset", job.id, {
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
