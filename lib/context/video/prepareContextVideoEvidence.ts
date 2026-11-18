import { z } from "zod";
import { parseContextUrl } from "../parseContextUrl";
import type { ContextBriefDocument } from "../selectContextDocuments";
import { selectContextVideoArtistResearch } from "./selectContextVideoArtistResearch";
import type { ContextRequestRecord } from "../runContextRequest";
import type {
  ContextEnrichmentModule,
  ContextEnrichmentResult,
} from "../enrichment/runContextEnrichment";
import { contextVideoEvidenceSchema } from "./contextVideoEvidenceSchema";

type Dependencies = {
  authorize: (actor: string, owner: string) => Promise<unknown>;
  readRequest: (owner: string, requestId: string) => Promise<ContextRequestRecord>;
  /** Must return retained evidence from authorized sources, never infer identity from the uploader. */
  readEvidence: (owner: string, requestId: string) => Promise<unknown>;
  readArtistDocuments: (
    owner: string,
    artistSubjectIds: string[],
  ) => Promise<{
    documents: ContextBriefDocument[];
    withdrawnSourceVersionIds: string[];
  }>;
};

/** Prepare one fixture-only video projection. No collection, persistence, accounting or public dispatch. */
export async function prepareContextVideoEvidence(
  actor: string,
  owner: string,
  requestId: string,
  deps: Dependencies,
): Promise<{
  module: ContextEnrichmentModule;
  result: ContextEnrichmentResult;
  reusedArtistDocuments: ContextBriefDocument[];
}> {
  actor = z.uuid().parse(actor).toLowerCase();
  owner = z.uuid().parse(owner).toLowerCase();
  requestId = z.uuid().parse(requestId).toLowerCase();
  await deps.authorize(actor, owner);
  const request = await deps.readRequest(owner, requestId);
  if (
    !request ||
    request.id.toLowerCase() !== requestId ||
    request.owner_id.toLowerCase() !== owner ||
    request.status === "cancelled"
  )
    throw new Error("Video context request unavailable");
  const resource = parseContextUrl(request.input.url);
  if (resource.provider !== "youtube") throw new Error("Single YouTube video required");
  const evidence = contextVideoEvidenceSchema.parse(await deps.readEvidence(owner, requestId));
  if (
    evidence.requestId.toLowerCase() !== requestId ||
    evidence.ownerId.toLowerCase() !== owner ||
    evidence.videoId !== resource.id
  )
    throw new Error("Video evidence does not match the selected request");
  let reusedArtistDocuments: ContextBriefDocument[] = [];
  if (evidence.identity.state === "matched") {
    const subjectIds = evidence.identity.creditedArtists.map(artist =>
      artist.subjectId.toLowerCase(),
    );
    const saved = await deps.readArtistDocuments(owner, subjectIds);
    reusedArtistDocuments = selectContextVideoArtistResearch(owner, subjectIds, saved);
  }
  await deps.authorize(actor, owner);
  const sources = evidence.sources.map(source => ({
    url: resource.url,
    kind: "provider_metadata",
    content: source,
  }));
  const module: ContextEnrichmentModule = {
    key: "video-narrative-fixture-v1",
    topic: "video_narrative",
    subjectId: evidence.videoSubjectId,
    provider: "retained-evidence",
    model: "none",
    evidenceKind: "interpretation",
    input: evidence,
    sources,
  };
  const result: ContextEnrichmentResult = {
    content: {
      ...evidence,
      originalSongLyrics: "not_established",
      scope: "video_only",
      artistBrand: "not_established",
    },
    // No projection can establish original-song completeness, even with every video frame analyzed.
    coverage: "partial",
    costUsd: null,
    costStatus: "unknown",
    trace: {
      method: "retained_video_projection",
      sourceVersionIds: evidence.sources.map(source => source.versionId),
    },
  };
  return { module, result, reusedArtistDocuments };
}
