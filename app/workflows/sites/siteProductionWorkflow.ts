import { albumMetadataStep } from "./albumMetadataStep";
import { combineAlbumContext } from "@/lib/sites/production/combineAlbumContext";
import type { ReleaseContext } from "@/lib/sites/production/schema";
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
    const isAlbum = /^https:\/\/open\.spotify\.com\/album\//.test(site.release_url);
    if (!selectedBrief && /^https:\/\/open\.spotify\.com\/(track|album)\//.test(site.release_url)) {
      stage = "album metadata";
      const album = isAlbum ? await albumMetadataStep(site, accountId) : undefined;
      const recordings = album?.tracks.map(track => ({
        ...site,
        release_url: track.url,
        draft: null,
      })) ?? [site];
      const contexts: ReleaseContext[] = [];
      for (const trackSite of recordings) {
        stage = "metadata";
        const saved = await metadataStep(trackSite, accountId, Boolean(album));
        stage = "audio acquisition";
        const audio = await audioSourceStep(trackSite, accountId, saved, Boolean(album));
        if (audio.status === "available") {
          stage = "lyrics";
          await audioAnalysisStep(trackSite, accountId, saved, "lyrics");
          stage = "audio analysis";
          await audioAnalysisStep(trackSite, accountId, saved, "summary");
        }
        stage = "artwork analysis";
        await enrichContextStep(trackSite, accountId, saved, "artwork_branding");
        stage = "artist research";
        await enrichContextStep(trackSite, accountId, saved, "artist_research");
        stage = "context brief";
        const trackContext = await contextBriefStep(trackSite, accountId, saved);
        if (audio.status === "unavailable") {
          trackContext.gaps = [
            { trackUrl: saved.release.url, topic: "audio_source", reason: audio.reason },
            {
              trackUrl: saved.release.url,
              topic: "lyrics",
              reason: "Not analyzed: verified audio unavailable",
            },
            {
              trackUrl: saved.release.url,
              topic: "song_summary",
              reason: "Not analyzed: verified audio unavailable",
            },
          ];
          trackContext.music = {
            status: "unavailable",
            coverage: "none",
            analysis: "",
            reason: audio.reason,
          };
        }
        contexts.push(trackContext);
      }
      context = album ? combineAlbumContext(album, contexts) : contexts[0];
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
