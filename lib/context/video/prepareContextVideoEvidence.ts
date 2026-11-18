import { z } from "zod";
import { parseContextUrl } from "../parseContextUrl";
import { selectContextDocuments, type ContextBriefDocument } from "../selectContextDocuments";
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
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  await deps.authorize(actor, owner);
  const request = await deps.readRequest(owner, requestId);
  if (
    !request ||
    request.id !== requestId ||
    request.owner_id !== owner ||
    request.status === "cancelled"
  )
    throw new Error("Video context request unavailable");
  const resource = parseContextUrl(request.input.url);
  if (resource.provider !== "youtube") throw new Error("Single YouTube video required");
  const evidence = contextVideoEvidenceSchema.parse(await deps.readEvidence(owner, requestId));
  if (
    evidence.requestId !== requestId ||
    evidence.ownerId !== owner ||
    evidence.videoId !== resource.id
  )
    throw new Error("Video evidence does not match the selected request");
  let reusedArtistDocuments: ContextBriefDocument[] = [];
  if (evidence.identity.state === "matched") {
    const subjectIds = evidence.identity.creditedArtists.map(artist => artist.subjectId);
    const saved = await deps.readArtistDocuments(owner, subjectIds);
    if (saved.documents.length > 1000 || saved.withdrawnSourceVersionIds.length > 32000)
      throw new Error("Artist evidence exceeds bounded selection");
    // Compare UUID identity canonically; return retained documents byte-for-byte unchanged.
    const originals = new Map<ContextBriefDocument, ContextBriefDocument>();
    for (const document of saved.documents.filter(doc => Boolean(doc.resultId))) {
      originals.set(
        {
          ...document,
          ownerId: document.ownerId.toLowerCase(),
          subjectId: document.subjectId.toLowerCase(),
          sourceVersionIds: document.sourceVersionIds.map(id => id.toLowerCase()),
        },
        document,
      );
    }
    reusedArtistDocuments = selectContextDocuments([...originals.keys()], {
      ownerId: owner.toLowerCase(),
      subjectIds: subjectIds.map(id => id.toLowerCase()),
      topics: ["artist_research"],
      maxCharacters: 32000,
      requiredCoverage: "partial",
      withdrawnSourceVersionIds: saved.withdrawnSourceVersionIds.map(id => id.toLowerCase()),
    }).documents.map(document => originals.get(document)!);
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
