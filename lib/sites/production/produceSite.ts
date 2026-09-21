import { reviseProduction } from "./reviseProduction";
import type { Site } from "../schema";
import { collectReleaseContext } from "./collectReleaseContext";
import { directExperience } from "./directExperience";
import { produceAssets } from "./produceAssets";
import { buildExperience } from "./buildExperience";
import { reviewExperience } from "./reviewExperience";
/** Bounded creative production; no persistence until a complete candidate exists. */
export async function produceSite(site: Site, instruction: string, accountId: string) {
  const context = await collectReleaseContext(site, accountId);
  let direction = await directExperience(site, instruction, context, accountId);
  let assets = await produceAssets(site, direction, accountId);
  let snapshot = await buildExperience(
    site,
    instruction,
    { release: context, direction },
    assets,
    accountId,
  );
  const reviews = [await reviewExperience(snapshot, direction, accountId, site.id)];
  if (reviews[0].verdict === "revise") {
    ({ snapshot, direction, assets } = await reviseProduction(
      site,
      instruction,
      context,
      direction,
      assets,
      snapshot,
      reviews[0],
      accountId,
    ));
    reviews.push(await reviewExperience(snapshot, direction, accountId, site.id));
  }
  return {
    ...snapshot,
    production: {
      version: 1 as const,
      context,
      direction,
      reviews,
      status:
        reviews.at(-1)!.verdict === "pass" ? ("reviewed" as const) : ("needs-review" as const),
    },
  };
}
