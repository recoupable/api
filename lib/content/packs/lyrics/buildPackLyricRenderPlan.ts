import { createHash } from "node:crypto";
import { buildPackLyricTimeline } from "./buildPackLyricTimeline";
import { PACK_LYRIC_FONT_SHA256, PACK_LYRIC_SOURCE_FONT_SHA256 } from "./packLyricRenderTypes";
/** Internal local-only plan identity. This is neither authenticated evidence nor whole-composition identity. */
export function buildPackLyricRenderPlan(
  input: unknown,
  start: number,
  seconds: number,
  rendererBuild: string,
) {
  const timeline = buildPackLyricTimeline(input);
  if (timeline.status !== "ready") throw new Error(timeline.reason);
  const { target, alignment } = timeline;
  for (const [value, expected] of [
    [start, target.excerpt.startMs],
    [seconds, target.excerpt.endMs - target.excerpt.startMs],
  ]) {
    const ms = value * 1000;
    if (!Number.isFinite(ms) || Math.abs(ms - Math.round(ms)) > 1e-6 || Math.round(ms) !== expected)
      throw new Error("Unsupported precision or mismatched excerpt");
  }
  if (!/^[a-f0-9]{64}$/.test(rendererBuild)) throw new Error("Unqualified renderer build");
  if (timeline.cues.length > 128) throw new Error("Internal lyric render cue bound exceeded");
  const cues = timeline.cues.map(cue => {
    if (!/^[\x20-\x7e]+$/.test(cue.text)) throw new Error("glyph_not_qualified");
    const startFrame = Math.ceil((cue.startMs * 30) / 1000),
      endFrame = Math.ceil((cue.endMs * 30) / 1000);
    if (endFrame <= startFrame) throw new Error("Insufficient temporal resolution for lyric word");
    return { ...cue, startFrame, endFrame };
  });
  const frames = Math.ceil(((target.excerpt.endMs - target.excerpt.startMs) * 30) / 1000);
  const payload = [
    "pack-lyric-render-v1",
    target.jobId,
    target.jobRevision,
    target.assetId,
    target.assetAttempt,
    target.recording.storageKey,
    target.recording.sha256,
    target.recording.durationMs,
    target.excerpt.startMs,
    target.excerpt.endMs,
    alignment.revision,
    alignment.evidenceRef,
    alignment.verificationRef,
    alignment.verifiedRange.startMs,
    alignment.verifiedRange.endMs,
    timeline.typography,
    PACK_LYRIC_SOURCE_FONT_SHA256,
    PACK_LYRIC_FONT_SHA256,
    "fontTools4.61.1-no-timestamp-no-instancing-v1",
    "basic-latin-32-126-v1",
    30,
    1,
    "zero-pts-cfr-before-overlay-v1",
    "textfile-expansion-none-serial-ffv1-v1",
    rendererBuild,
    cues.map(c => [
      c.text,
      c.sourceStartMs,
      c.sourceEndMs,
      c.startMs,
      c.endMs,
      c.startFrame,
      c.endFrame,
    ]),
  ];
  return {
    timeline,
    cues,
    frames,
    payload,
    digest: createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex"),
    startSeconds: (target.excerpt.startMs / 1000).toFixed(3),
    durationSeconds: ((target.excerpt.endMs - target.excerpt.startMs) / 1000).toFixed(3),
  };
}
