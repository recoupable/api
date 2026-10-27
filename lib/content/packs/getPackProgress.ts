import type { PackSnapshot } from "./packTypes";
import { getPackBriefReadiness } from "./getPackBriefReadiness";
import { isPackAssetUsable } from "./isPackAssetUsable";

/** Read-only projection of current saved outputs; attempts are not additional creative pieces. */
export function getPackProgress({ job, assets }: PackSnapshot) {
  const requested = [
    ["video", job.deliverables.videos],
    ["artwork", job.deliverables.artwork],
    ["quote_card", job.deliverables.quote_cards],
    ["carousel", job.deliverables.carousels],
    ["visualizer", job.deliverables.visualizers],
  ] as const;
  const requestedKeys = new Set(
    requested.flatMap(([kind, count]) =>
      Array.from({ length: count }, (_, ordinal) => `${kind}:${ordinal}`),
    ),
  );
  const unique = [
    ...new Map(
      assets
        .filter(a => a.job_id === job.id && requestedKeys.has(`${a.kind}:${a.ordinal}`))
        .map(a => [a.id, a]),
    ).values(),
  ];
  const usable = unique.filter(isPackAssetUsable);
  const files = (asset: (typeof unique)[number]) => {
    const composition = asset.provider_state.composition as { files?: unknown } | undefined;
    const staged = Array.isArray(composition?.files) ? composition.files : [];
    return [...asset.files, ...staged].filter(
      (file): file is { storage_key: string } =>
        !!file &&
        typeof file === "object" &&
        typeof file.storage_key === "string" &&
        file.storage_key.startsWith(`${job.owner_id}/release-packs/`),
    );
  };
  const passed = (asset: (typeof unique)[number]) =>
    (asset.qa ?? (asset.provider_state.inspection as { passed?: unknown } | undefined))?.passed ===
    true;
  const complete =
    job.status === "completed" &&
    requestedKeys.size > 0 &&
    [...requestedKeys].every(key => usable.some(a => `${a.kind}:${a.ordinal}` === key));
  const blockers: { code: string; asset_id?: string }[] = [];
  if (!getPackBriefReadiness(job.brief).ready) blockers.push({ code: "brief_incomplete" });
  if (job.status === "awaiting_approval") blockers.push({ code: "approval_required" });
  if (job.status === "ready_to_quote") blockers.push({ code: "quote_required" });
  if (job.dispatch_state === "uncertain") blockers.push({ code: "dispatch_uncertain" });
  for (const asset of unique) {
    if (asset.status === "failed" || asset.status === "uncertain")
      blockers.push({ code: `asset_${asset.status}`, asset_id: asset.id });
    if (asset.status === "completed" && !isPackAssetUsable(asset))
      blockers.push({ code: "asset_not_usable", asset_id: asset.id });
  }
  if (job.error) blockers.push({ code: "job_error" });
  if (job.status === "completed" && !complete) blockers.push({ code: "incomplete_outputs" });
  // These are persisted timestamps, never inferred from updated_at or the current clock.
  const timestamp = (key: string) =>
    typeof job[key] === "string" && Number.isFinite(Date.parse(job[key] as string))
      ? (job[key] as string)
      : null;
  return {
    job_id: job.id,
    revision: job.revision,
    status: job.status,
    complete,
    counts: {
      requested_pieces: requestedKeys.size,
      requested_files: requested.reduce(
        (sum, [kind, count]) => sum + count * (kind === "carousel" ? 4 : 1),
        0,
      ),
      generated_pieces: unique.filter(a => files(a).length > 0).length,
      generated_files: new Set(unique.flatMap(a => files(a).map(f => f.storage_key))).size,
      qa_passed_pieces: unique.filter(passed).length,
      usable_pieces: usable.length,
      running_pieces: unique.filter(a => a.status === "running").length,
      failed_pieces: unique.filter(a => a.status === "failed").length,
      uncertain_pieces: unique.filter(a => a.status === "uncertain").length,
    },
    running_asset_ids: unique.filter(a => a.status === "running").map(a => a.id),
    blockers,
    milestones: {
      intent_at: timestamp("created_at"),
      intake_ready_at: timestamp("sufficient_brief_at"),
      approved_at: timestamp("approved_at"),
      running_at: timestamp("running_at"),
      first_usable_asset_at: usable.length ? timestamp("first_usable_asset_at") : null,
      full_pack_completed_at: complete ? timestamp("completed_at") : null,
      last_exported_at: timestamp("exported_at"),
    },
    // Existing receipts cannot separate waits, rendering and active processing.
    timings: {
      user_wait_ms: null,
      provider_render_ms: null,
      active_processing_ms: null,
      remaining_ms: null,
    },
  };
}
