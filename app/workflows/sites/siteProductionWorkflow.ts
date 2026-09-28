import { prepareSkillStep } from "./prepareSkillStep";
import { metadataStep } from "./metadataStep";
import { audioSourceStep } from "./audioSourceStep";
import { audioAnalysisStep } from "./audioAnalysisStep";
import { enrichContextStep } from "./enrichContextStep";
import { contextBriefStep } from "./contextBriefStep";
import { conceptPitchSchema, type ConceptPitch } from "@/lib/sites/production/conceptSchema";
import { selectConceptStep } from "./selectConceptStep";
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
      { instruction, context, approvedConcept },
      accountId,
      site.id,
    );
    stage = "concept";
    const selected =
      approvedConcept ?? (await selectConceptStep(site, instruction, context, accountId));
    stage = "direction";
    let direction = await directionStep(site, instruction, context, accountId, selected);
    stage = "assets";
    let assets = await assetsStep(site, direction, accountId);
    stage = "build";
    let snapshot = await buildStep(
      site,
      instruction,
      { release: context, direction },
      assets,
      accountId,
    );
    stage = "review";
    const reviews = [await reviewStep(snapshot, direction, accountId, site.id, context.siteSkill)];
    while (
      reviews.length < 4 &&
      reviews.at(-1)!.verdict === "revise" &&
      !reviews.at(-1)!.issues.some(issue => issue.module === "direction")
    ) {
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
  } catch {
    return {
      error: `Site production stopped during ${stage}. Your existing draft is unchanged.`,
    };
  }
}
