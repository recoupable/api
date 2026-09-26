import { reviseStep } from "./reviseStep";
import type { Site } from "@/lib/sites/schema";
import { collectContextStep } from "./collectContextStep";
import { directionStep } from "./directionStep";
import { assetsStep } from "./assetsStep";
import { buildStep } from "./buildStep";
import { reviewStep } from "./reviewStep";
import { saveSiteStep } from "./saveSiteStep";
/** Completed stages are durable; a browser disconnect does not discard production. */
export async function siteProductionWorkflow(
  site: Site,
  instruction: string,
  accountId: string,
  contextBriefId?: string,
) {
  "use workflow";
  try {
    const context = await collectContextStep(site, accountId, contextBriefId);
    let direction = await directionStep(site, instruction, context, accountId);
    let assets = await assetsStep(site, direction, accountId);
    let snapshot = await buildStep(
      site,
      instruction,
      { release: context, direction },
      assets,
      accountId,
    );
    const reviews = [await reviewStep(snapshot, direction, accountId, site.id)];
    if (reviews[0].verdict === "revise") {
      ({ snapshot, direction, assets } = await reviseStep(
        site,
        instruction,
        context,
        direction,
        assets,
        snapshot,
        reviews[0],
        accountId,
      ));
      reviews.push(await reviewStep(snapshot, direction, accountId, site.id));
    }
    return await saveSiteStep(
      site,
      {
        ...snapshot,
        production: {
          version: 1,
          context,
          direction,
          reviews,
          status: reviews[reviews.length - 1].verdict === "pass" ? "reviewed" : "needs-review",
        },
      },
      accountId,
    );
  } catch {
    return {
      error: "Production stopped before a draft could be saved. Your existing draft is unchanged.",
    };
  }
}
