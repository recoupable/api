import type { Site, SiteAsset, SiteSnapshot } from "../schema";
import type { ReleaseContext, CreativeDirection, CreativeReview } from "./schema";
import { produceAssets } from "./produceAssets";
import { buildExperience } from "./buildExperience";
/** Route concrete review findings to the module responsible, for the next repair pass. */
export async function reviseProduction(
  site: Site,
  instruction: string,
  context: ReleaseContext,
  direction: CreativeDirection,
  assets: SiteAsset[],
  snapshot: SiteSnapshot,
  review: CreativeReview,
  accountId: string,
) {
  const feedback = JSON.stringify(review.issues);
  const reviseDirection = review.issues.some(i => i.module === "direction");
  const reviseAssets = reviseDirection || review.issues.some(i => i.module === "assets");
  const currentSite = {
    ...site,
    draft: {
      ...snapshot,
      production: {
        version: 1 as const,
        context,
        direction,
        reviews: [review],
        status: "needs-review" as const,
      },
    },
  };
  if (reviseDirection) return { direction, assets, snapshot };
  const nextDirection = direction;
  const nextAssets = reviseAssets
    ? await produceAssets(currentSite, nextDirection, accountId, feedback)
    : assets;
  const next = await buildExperience(
    site,
    instruction,
    { release: context, direction: nextDirection },
    nextAssets,
    accountId,
    snapshot,
    review,
  );
  return { direction: nextDirection, assets: nextAssets, snapshot: next };
}
