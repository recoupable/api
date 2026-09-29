import { siteTable } from "./siteTable";
import type { SiteSnapshot } from "@/lib/sites/schema";
/** Workspace-scoped, bounded review evidence; never a cross-customer training pool. */
export async function selectSiteAssetOutcomes(ownerId: string) {
  const { data, error } = await siteTable()
    .select("draft")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? [])
    .flatMap(row => {
      const draft = row.draft as SiteSnapshot | null;
      const review = draft?.production?.reviews.at(-1);
      if (!draft || !review) return [];
      return draft.assets
        .filter(asset => asset.generation)
        .map(asset => ({
          model: asset.generation!.model,
          rationale: asset.generation!.rationale,
          generationMs: asset.generation!.durationMs,
          siteVerdict: review.verdict,
          assetIssues: review.issues
            .filter(issue => issue.module === "assets")
            .map(issue => ({ detail: issue.detail.slice(0, 500), fix: issue.fix.slice(0, 500) })),
          caveat:
            "Whole-site review; not a controlled model comparison or proof of temporal video quality.",
        }));
    })
    .slice(0, 12);
}
