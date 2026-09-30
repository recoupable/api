import type { reviseProduction } from "@/lib/sites/production/reviseProduction";
import { assetsStep } from "./assetsStep";
import { buildStep } from "./buildStep";
/** Revision code generation uses the same durable, compacting turn loop as first builds. */
export async function reviseStep(...args: Parameters<typeof reviseProduction>) {
  const [site, instruction, context, direction, assets, snapshot, review, accountId] = args;
  if (review.issues.some(issue => issue.module === "direction"))
    return { direction, assets, snapshot };
  const nextAssets = review.issues.some(issue => issue.module === "assets")
    ? await assetsStep(
        { ...site, draft: snapshot },
        direction,
        accountId,
        JSON.stringify(review.issues),
      )
    : assets;
  const next = await buildStep(
    site,
    instruction,
    { release: context, direction },
    nextAssets,
    accountId,
    snapshot,
    review,
  );
  return { direction, assets: nextAssets, snapshot: next };
}
