import { getWorkflowMetadata } from "workflow";
import { readAdmittedPackSnapshot } from "@/lib/content/packs/foundation/readAdmittedPackSnapshot";
import { createPackFoundationPlan } from "@/lib/content/packs/foundation/createPackFoundationPlan";
import { bindPackFoundationFiles } from "@/lib/content/packs/foundation/bindPackFoundationFiles";
import { getPackConfigurationDigest } from "@/lib/content/packs/getPackConfigurationDigest";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import { fetchPackMedia } from "@/lib/content/packs/fetchPackMedia";
import type { PackActor, PackAsset } from "@/lib/content/packs/packTypes";
import type { PackFoundationPlan } from "@/lib/content/packs/foundation/packFoundationSchema";
export async function bindPackFoundationFilesStep(
  actor: PackActor,
  jobId: string,
  plan: PackFoundationPlan,
  asset: PackAsset | undefined,
) {
  "use step";
  const saved = await readAdmittedPackSnapshot(actor, jobId, getWorkflowMetadata().workflowRunId);
  const currentPlan = createPackFoundationPlan(saved, {
    ...(plan.selection === "explicit" ? { foundationAssetId: plan.asset_id! } : {}),
    dependentAssetIds: plan.dependent_asset_ids,
  });
  const currentAsset = saved.assets.find(a => a.id === currentPlan.asset_id);
  if (
    getPackConfigurationDigest(currentPlan) !== getPackConfigurationDigest(plan) ||
    getPackConfigurationDigest(currentAsset ?? null) !== getPackConfigurationDigest(asset ?? null)
  )
    throw new Error("Retained foundation snapshot changed before file binding");
  return bindPackFoundationFiles(plan, asset, async file => {
    const url = await createSignedFileUrlByKey({ key: file.storage_key, expiresInSeconds: 3600 });
    return (await fetchPackMedia(url)).bytes;
  });
}
bindPackFoundationFilesStep.maxRetries = 0;
