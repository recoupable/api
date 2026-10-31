import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import { getPackBriefReadiness } from "./getPackBriefReadiness";
import type { PackSnapshot } from "./packTypes";
/** Account-scoped readback exposes usable and rejected files separately with refreshed private URLs. */
export async function readPackSnapshot(snapshot: PackSnapshot) {
  const {
    owner_id: _owner,
    created_by: _creator,
    wallet_period: _period,
    idempotency_key: _key,
    fingerprint: _fingerprint,
    ...job
  } = snapshot.job;
  const assets = [];
  for (const asset of snapshot.assets) {
    const { provider_state: _state, ...visible } = asset;
    const files = [];
    for (const file of asset.files) {
      if (!file.storage_key.startsWith(`${snapshot.job.owner_id}/release-packs/`))
        throw new Error("Pack output ownership mismatch");
      files.push({
        ...file,
        url: await createSignedFileUrlByKey({ key: file.storage_key, expiresInSeconds: 3600 }),
      });
    }
    assets.push({
      ...visible,
      files,
      usable: asset.status === "completed" && asset.qa?.passed === true && !!asset.caption,
    });
  }
  const readiness = getPackBriefReadiness(snapshot.job.brief);
  return {
    job,
    assets,
    readiness,
    next_action: readiness.ready
      ? snapshot.job.status === "awaiting_approval"
        ? "Review this complete quote and approve its budget before generation."
        : snapshot.job.status === "running"
          ? "The approved pack is running. Poll this saved job; do not submit another pack."
          : snapshot.job.status === "completed"
            ? "Review and download the pack. Publishing remains your choice."
            : ["failed", "partial"].includes(snapshot.job.status)
              ? "Review completed files and the exact failed or uncertain attempt. Request a targeted retry quote for confirmed failures; accepted requests must be resumed without resubmission."
              : readiness.next_action
      : readiness.next_action,
  };
}
