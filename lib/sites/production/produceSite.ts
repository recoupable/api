import { runBoundedSiteRepairs } from "./runBoundedSiteRepairs";
import { readSiteRepairControl } from "./readSiteRepairControl";
import { SiteError } from "../SiteError";
import { prepareSiteSkill } from "../skills/prepareSiteSkill";
import { conceptPitchSchema, type ConceptPitch } from "@/lib/sites/production/conceptSchema";
import { selectExperienceConcept } from "./selectExperienceConcept";
import { reviseProduction } from "./reviseProduction";
import type { Site } from "../schema";
import { collectReleaseContext } from "./collectReleaseContext";
import { directExperience } from "./directExperience";
import { produceAssets } from "./produceAssets";
import { buildExperience } from "./buildExperience";
import { reviewExperience } from "./reviewExperience";
/** Review-driven creative production; no persistence until a complete candidate exists. */
export async function produceSite(
  site: Site,
  instruction: string,
  accountId: string,
  contextBriefId?: string,
  approvedConcept?: ConceptPitch,
) {
  if (approvedConcept) conceptPitchSchema.parse(approvedConcept);
  const context = await collectReleaseContext(site, accountId, contextBriefId);
  context.siteSkill = await prepareSiteSkill(
    {
      instruction,
      context,
      approvedConcept,
      currentExperience: approvedConcept ? null : site.draft?.production?.direction,
      currentVisualWorld: site.draft?.brandWorld?.specification,
    },
    accountId,
    site.id,
  );
  let direction;
  let assets;
  if (site.draft?.production && !approvedConcept) {
    direction = site.draft.production.direction;
    assets = site.draft.assets;
    if (context.siteSkill.assetRevision !== undefined) {
      direction = { ...direction, assets: context.siteSkill.assetRevision };
      assets = await produceAssets(site, direction, accountId);
    }
  } else {
    const selected =
      approvedConcept ?? (await selectExperienceConcept(site, instruction, context, accountId));
    direction = await directExperience(site, instruction, context, accountId, selected);
    assets = await produceAssets(site, direction, accountId);
  }
  let snapshot = await buildExperience(
    site,
    instruction,
    { release: context, direction },
    assets,
    accountId,
  );
  const firstReview = await reviewExperience(
    snapshot,
    direction,
    accountId,
    site.id,
    context.siteSkill,
  );
  // Engineering stage limits reduce the existing repair loop; they are not a monetary quote.
  const repairResult = await runBoundedSiteRepairs({
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
      reviewExperience(candidate, direction, accountId, site.id, context.siteSkill),
  });
  if (repairResult.status === "stopped" && repairResult.reason !== "direction-required") {
    const reason = repairResult.reason;
    const status =
      reason === "review-blocked"
        ? 402
        : reason === "revision-changed" || reason === "cancelled"
          ? 409
          : 422;
    const detail =
      reason === "attempts-exhausted"
        ? "repair attempt limit"
        : reason === "time-exhausted"
          ? "repair time limit"
          : reason === "review-blocked"
            ? "credit limit"
            : "site revision or availability changed";
    throw new SiteError(
      status,
      `Site production stopped: ${detail}. Your saved draft and published version are unchanged. Revise the brief or try again.`,
    );
  }
  snapshot = repairResult.candidate;
  const reviews = repairResult.history.map(item => item.review);
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
