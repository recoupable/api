import type { Site, SiteAsset, SiteSnapshot } from "../schema";
import type { ReleaseContext, CreativeDirection, CreativeReview } from "./schema";
import { directExperience } from "./directExperience";
import { produceAssets } from "./produceAssets";
import { buildExperience } from "./buildExperience";
/** Route concrete review findings to the module responsible, with a single bounded pass. */
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
  const nextDirection = reviseDirection
    ? await directExperience(
        site,
        `${instruction}\nAddress these review findings: ${feedback}`,
        context,
        accountId,
      )
    : direction;
  const nextAssets = reviseAssets
    ? await produceAssets(site, nextDirection, accountId, feedback)
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
