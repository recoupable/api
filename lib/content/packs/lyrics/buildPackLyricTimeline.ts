import { packLyricTimelineSchema, type PackLyricTimelineResult } from "./packLyricTimelineSchema";

/** Pure internal contract. The trusted caller must verify words/timing against the bound recording. */
export function buildPackLyricTimeline(input: unknown): PackLyricTimelineResult {
  const { expected: target, alignment, typography } = packLyricTimelineSchema.parse(input);
  if (!alignment)
    return { status: "gap", reason: "missing_verified_alignment", target, typography };
  const excerpt = target.excerpt;
  const cues = alignment.words
    .filter(word => word.endMs > excerpt.startMs && word.startMs < excerpt.endMs)
    .map(word => ({
      text: word.text,
      startMs: Math.max(word.startMs, excerpt.startMs) - excerpt.startMs,
      endMs: Math.min(word.endMs, excerpt.endMs) - excerpt.startMs,
      sourceStartMs: word.startMs,
      sourceEndMs: word.endMs,
    }));
  if (!cues.length) return { status: "gap", reason: "no_aligned_words", target, typography };
  return {
    status: "ready",
    target,
    typography,
    alignment: {
      revision: alignment.revision,
      evidenceRef: alignment.evidenceRef,
      verificationRef: alignment.verificationRef,
      verifiedRange: alignment.verifiedRange,
    },
    cues,
  };
}
