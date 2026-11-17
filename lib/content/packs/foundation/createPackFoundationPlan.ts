import { releasePackAssetKinds } from "../releasePackSchema";
import { getPackConfigurationDigest } from "../getPackConfigurationDigest";
import { getPackBriefFingerprint } from "../getPackBriefFingerprint";
import type { PackSnapshot } from "../packTypes";
import type { PackFoundationPlan, PackFoundationSelection } from "./packFoundationSchema";
/** Unwired: choose only an existing quoted artwork; never allocate another item or charge. */
export function createPackFoundationPlan(
  snapshot: PackSnapshot,
  input: PackFoundationSelection,
): PackFoundationPlan {
  const { job, assets } = snapshot;
  if (!job.quote || job.quote.retry_asset_id || job.quote.revision !== job.revision)
    throw new Error("Foundation planning requires the current full pack quote");
  if (job.quote.brief_fingerprint !== getPackBriefFingerprint(job.brief))
    throw new Error("Foundation brief no longer matches the approved quote");
  if (job.quote.assets.filter(a => a.kind === "artwork").length !== job.deliverables.artwork)
    throw new Error("Foundation artwork quote does not match requested deliverables");
  if (new Set(assets.map(a => a.id)).size !== assets.length)
    throw new Error("Duplicate pack asset IDs");
  const quoted = assets.filter(
    a =>
      a.job_id === job.id &&
      job.quote!.assets.some(
        q =>
          q.kind === a.kind &&
          q.ordinal === a.ordinal &&
          q.credits === a.credits &&
          q.maximum_usd === a.maximum_usd,
      ),
  );
  const artwork = quoted
    .filter(a => a.kind === "artwork")
    .sort((a, b) => a.ordinal - b.ordinal || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const selected = input.foundationAssetId
    ? artwork.find(a => a.id === input.foundationAssetId)
    : artwork[0];
  if (input.foundationAssetId && !selected)
    throw new Error("Selected foundation is not a quoted artwork asset");
  const dependents = [...new Set(input.dependentAssetIds)].sort();
  for (const id of dependents) {
    const asset = quoted.find(a => a.id === id);
    // All current kinds generate stills through the existing image_urls adapter.
    if (!asset || !releasePackAssetKinds.includes(asset.kind) || id === selected?.id)
      throw new Error("Invalid foundation dependency");
  }
  const selection = input.foundationAssetId
    ? "explicit"
    : selected
      ? "fallback"
      : job.quote.assets.some(a => a.kind === "artwork")
        ? "missing"
        : "none_requested";
  const value = {
    version: 1 as const,
    job_id: job.id,
    owner_id: job.owner_id,
    revision: job.revision,
    quote_id: job.quote.id,
    quote_sha256: getPackConfigurationDigest(job.quote),
    direction_sha256: getPackBriefFingerprint(job.brief),
    asset_id: selected?.id ?? null,
    selection,
    dependent_asset_ids: dependents,
  };
  return {
    ...value,
    selection,
    digest: getPackConfigurationDigest(value),
  };
}
