import { runBoundedSiteRepairs } from "./runBoundedSiteRepairs";
import { readSiteRepairControl } from "./readSiteRepairControl";
import { getSiteRepairStopError } from "./getSiteRepairStopError";
import { reviseProduction } from "./reviseProduction";
import { reviewExperience } from "./reviewExperience";
import type { Site, SiteAsset, SiteSnapshot } from "../schema";
import type { ReleaseContext, CreativeDirection, CreativeReview } from "./schema";

/** Adapt direct production effects to the bounded coordinator, preserving its outcome. */
export async function repairDirectSite(input: {
  site: Site;
  instruction: string;
  accountId: string;
  context: ReleaseContext;
  direction: CreativeDirection;
  assets: SiteAsset[];
  snapshot: SiteSnapshot;
  firstReview: CreativeReview;
}) {
  const { site, instruction, accountId, context, snapshot, firstReview } = input;
  let { direction, assets } = input;
  // Engineering stage limits reduce repeated work; they are not a monetary quote.
  const result = await runBoundedSiteRepairs({
    snapshot,
    review: firstReview,
    baseRevision: site.revision,
    limits: { maxAttempts: 2, deadlineMs: Date.now() + 20 * 60 * 1000 },
    now: Date.now,
    readControl: () => readSiteRepairControl(site, accountId),
    repair: async (candidate, review) => {
      const next = await reviseProduction(
        site,
        instruction,
        context,
        direction,
        assets,
        candidate,
        review,
        accountId,
      );
      direction = next.direction;
      assets = next.assets;
      return next.snapshot;
    },
    reviewCandidate: candidate =>
      reviewExperience(candidate, direction, accountId, site.id, context.siteSkill, {
        baseRevision: site.revision,
        releaseArtwork: context.release?.artwork ?? null,
      }),
  });
  if (result.status === "stopped" && result.reason !== "direction-required")
    throw getSiteRepairStopError(result.reason);
  return {
    snapshot: result.candidate,
    direction,
    reviews: result.history.map(item => item.review),
    status: result.status === "passed" ? ("reviewed" as const) : ("needs-review" as const),
  };
}
