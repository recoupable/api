import type { ContextVideoEvidence } from "./contextVideoEvidenceSchema";
import type {
  ContextEnrichmentModule,
  ContextEnrichmentResult,
} from "../enrichment/runContextEnrichment";

/** Pure video-only projection; no reader calls, authorization decision or persistence. */
export function projectContextVideoEvidence(
  resourceUrl: string,
  evidence: ContextVideoEvidence,
): { module: ContextEnrichmentModule; result: ContextEnrichmentResult } {
  const sources = evidence.sources.map(source => ({
    url: resourceUrl,
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
  return { module, result };
}
