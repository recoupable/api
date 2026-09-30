import { revealBuildStep } from "./revealBuildStep";
import { prepareSkillStep } from "./prepareSkillStep";
import { metadataStep } from "./metadataStep";
import { audioSourceStep } from "./audioSourceStep";
import { audioAnalysisStep } from "./audioAnalysisStep";
import { enrichContextStep } from "./enrichContextStep";
import { contextBriefStep } from "./contextBriefStep";
import { conceptPitchSchema, type ConceptPitch } from "@/lib/sites/production/conceptSchema";
import { selectConceptStep } from "./selectConceptStep";
import { reviseStep } from "./reviseStep";
import type { CreativeDirection } from "@/lib/sites/production/schema";
import type { SiteAsset } from "@/lib/sites/schema";
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
  approvedConcept?: ConceptPitch,
) {
  "use workflow";
  let stage = "context";
  try {
    if (approvedConcept) conceptPitchSchema.parse(approvedConcept);
    const selectedBrief = contextBriefId ?? site.draft?.production?.context.engine?.briefId;
    let context;
    if (!selectedBrief && /^https:\/\/open\.spotify\.com\/track\//.test(site.release_url)) {
      stage = "metadata";
      const saved = await metadataStep(site, accountId);
      stage = "audio acquisition";
      await audioSourceStep(site, accountId, saved);
      stage = "lyrics";
      await audioAnalysisStep(site, accountId, saved, "lyrics");
      stage = "audio analysis";
      await audioAnalysisStep(site, accountId, saved, "summary");
      stage = "artwork analysis";
      await enrichContextStep(site, accountId, saved, "artwork_branding");
      stage = "artist research";
      await enrichContextStep(site, accountId, saved, "artist_research");
      stage = "context brief";
      context = await contextBriefStep(site, accountId, saved);
    } else context = await collectContextStep(site, accountId, selectedBrief);
    stage = "site skill";
    context.siteSkill = await prepareSkillStep(
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
    let direction: CreativeDirection;
    let assets: SiteAsset[];
    // Ordinary draft edits retain the selected concept; explicit selection starts a new one.
    if (site.draft?.production && !approvedConcept) {
      direction = site.draft.production.direction;
      assets = site.draft.assets;
      if (context.siteSkill.assetRevision !== undefined) {
        direction = { ...direction, assets: context.siteSkill.assetRevision };
        stage = "assets";
        assets = await assetsStep(site, direction, accountId);
      }
    } else {
      stage = "concept";
      const selected =
        approvedConcept ?? (await selectConceptStep(site, instruction, context, accountId));
      stage = "direction";
      direction = await directionStep(site, instruction, context, accountId, selected);
      await revealBuildStep(direction.concept, []).catch(() => undefined);
      stage = "assets";
      assets = await assetsStep(site, direction, accountId);
    }
    await revealBuildStep(direction.concept, assets).catch(() => undefined);
    stage = "build";
    let snapshot = await buildStep(
      site,
      instruction,
      { release: context, direction },
      assets,
      accountId,
    );
    await revealBuildStep(direction.concept, assets, snapshot).catch(() => undefined);
    stage = "review";
    const reviews = [await reviewStep(snapshot, direction, accountId, site.id, context.siteSkill)];
    while (
      reviews.at(-1)!.verdict === "revise" &&
      !reviews.at(-1)!.issues.some(issue => issue.module === "direction")
    ) {
      await revealBuildStep(
        direction.concept,
        assets,
        snapshot,
        reviews.at(-1)!.issues[0]?.fix,
      ).catch(() => undefined);
      stage = "implementation repair";
      ({ snapshot, direction, assets } = await reviseStep(
        site,
        instruction,
        context,
        direction,
        assets,
        snapshot,
        reviews.at(-1)!,
        accountId,
      ));
      await revealBuildStep(direction.concept, assets, snapshot).catch(() => undefined);
      stage = "review";
      reviews.push(await reviewStep(snapshot, direction, accountId, site.id, context.siteSkill));
    }
    stage = "save";
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
  } catch (error) {
    if (error instanceof Error && error.message === "SITE_BUILD_OUTPUT_LIMIT")
      return {
        error:
          "The site builder reached its generation limit before finishing the code. Your saved draft is unchanged.",
      };
    return {
      error: `Site production stopped during ${stage}. Your existing draft is unchanged.`,
    };
  }
}
