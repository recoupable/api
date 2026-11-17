import { createHash } from "node:crypto";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import { isPackAssetUsable } from "../isPackAssetUsable";
import type { PackAsset, PackFile } from "../packTypes";
import type { PackFoundationPlan, PackFoundationRecord } from "./packFoundationSchema";
/** Hash retained bytes before declaring readiness; signed URLs are never version identity. */
export async function bindPackFoundationFiles(
  plan: PackFoundationPlan,
  asset: PackAsset | undefined,
  readFile: (file: PackFile) => Promise<Uint8Array>,
): Promise<PackFoundationRecord> {
  if (plan.selection === "none_requested") return { plan, state: "none_requested", files: [] };
  if (!asset) return { plan, state: "unavailable", reason: "missing", files: [] };
  if (asset.id !== plan.asset_id || asset.job_id !== plan.job_id || asset.kind !== "artwork")
    throw new Error("Foundation asset identity changed");
  if (asset.status !== "completed")
    return {
      plan,
      state: "unavailable",
      reason: asset.status === "running" ? "in_flight" : asset.status,
      files: [],
    };
  if (!isPackAssetUsable(asset))
    return { plan, state: "unavailable", reason: "not_usable", files: [] };
  const files = [];
  for (const file of asset.files) {
    if (
      !file.storage_key.startsWith(`${plan.owner_id}/release-packs/`) ||
      file.storage_key.includes("..")
    )
      throw new Error("Foundation file ownership mismatch");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.content_type))
      throw new Error("Foundation must contain existing image reference inputs");
    const bytes = await readFile(file);
    if (bytes.byteLength !== file.bytes) throw new Error("Foundation file byte length changed");
    files.push({
      storage_key: file.storage_key,
      content_type: file.content_type,
      bytes: file.bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const identity = {
    plan: plan.digest,
    id: asset.id,
    job_id: asset.job_id,
    kind: asset.kind,
    ordinal: asset.ordinal,
    attempt: asset.attempt,
    status: asset.status,
    completed_at: asset.completed_at ?? null,
    credits: asset.credits,
    maximum_usd: asset.maximum_usd,
    caption: asset.caption,
    qa: asset.qa,
    error: asset.error,
    provider_state: asset.provider_state,
    files,
  };
  return {
    plan,
    state: "ready",
    files,
    asset_sha256: getPackConfigurationDigest(identity),
  };
}
