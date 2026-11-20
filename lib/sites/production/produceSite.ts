import { repairDirectSite } from "./repairDirectSite";
import { prepareSiteSkill } from "../skills/prepareSiteSkill";
import { conceptPitchSchema, type ConceptPitch } from "@/lib/sites/production/conceptSchema";
import { selectExperienceConcept } from "./selectExperienceConcept";
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
  const snapshot = await buildExperience(
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
    { baseRevision: site.revision, releaseArtwork: context.release?.artwork ?? null },
  );
  const repaired = await repairDirectSite({
    site,
    instruction,
    accountId,
    context,
    direction,
    assets,
    snapshot,
    firstReview,
  });
  return {
    ...repaired.snapshot,
    production: {
      version: 1 as const,
      context,
      direction: repaired.direction,
      reviews: repaired.reviews,
      status: repaired.status,
    },
  };
}
