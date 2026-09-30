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
  const reviews = [
    await reviewExperience(snapshot, direction, accountId, site.id, context.siteSkill),
  ];
  while (
    reviews.at(-1)!.verdict === "revise" &&
    !reviews.at(-1)!.issues.some(issue => issue.module === "direction")
  ) {
    ({ snapshot, direction, assets } = await reviseProduction(
      site,
      instruction,
      context,
      direction,
      assets,
      snapshot,
      reviews.at(-1)!,
      accountId,
    ));
    reviews.push(
      await reviewExperience(snapshot, direction, accountId, site.id, context.siteSkill),
    );
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
