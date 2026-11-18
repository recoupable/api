import { z } from "zod";
import { contextVideoLimits as limits } from "./contextVideoLimits";

const retainedText = z
  .string()
  .refine(
    value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Cs}]/u.test(value),
    "Malformed retained text",
  );
const text = retainedText
  .min(1)
  .max(limits.textCharacters)
  .refine(value => /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value));
const references = z
  .array(z.uuid())
  .min(1)
  .max(limits.sourceVersions)
  .refine(ids => new Set(ids.map(id => id.toLowerCase())).size === ids.length);
const range = {
  startSeconds: z.number().nonnegative().finite(),
  endSeconds: z.number().positive().finite(),
};
const unavailable = z.strictObject({ state: z.enum(["missing", "unavailable"]), reason: text });

/** Retained, authorized evidence supplied by an injected reader; never a public identity assertion. */
const evidenceShape = z.strictObject({
  requestId: z.uuid(),
  ownerId: z.uuid(),
  videoSubjectId: z.uuid(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  mediaVersion: text,
  durationSeconds: z.number().positive().finite().nullable(),
  variant: z.enum(["original", "live", "remix", "dubbed", "unknown"]),
  title: text,
  description: retainedText.max(limits.descriptionCharacters),
  channel: z.strictObject({ id: text, name: text }),
  performers: z
    .array(z.strictObject({ name: text, sourceVersionIds: references }))
    .max(limits.participants),
  identity: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("unresolved"), reason: text }),
    z.strictObject({
      state: z.literal("matched"),
      recordingSubjectId: z.uuid(),
      creditedArtists: z
        .array(z.strictObject({ subjectId: z.uuid(), name: text }))
        .min(1)
        .max(limits.participants),
      sourceVersionIds: references,
    }),
  ]),
  sources: z
    .array(
      z.strictObject({
        versionId: z.uuid(),
        videoId: z.string(),
        mediaVersion: text,
        retrievedAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(limits.sourceVersions),
  captions: z.union([
    unavailable,
    z.strictObject({
      state: z.literal("available"),
      sourceVersionIds: references,
      segments: z
        .array(
          z.strictObject({
            ...range,
            language: retainedText.min(1).max(limits.languageCharacters),
            text,
          }),
        )
        .min(1)
        .max(limits.captionSegments),
    }),
  ]),
  analysis: z.union([
    unavailable,
    z.strictObject({
      state: z.literal("available"),
      sourceVersionIds: references,
      ranges: z
        .array(
          z.strictObject({
            ...range,
            observations: z.array(text).min(1).max(limits.observationsPerRange),
            interpretation: text,
          }),
        )
        .min(1)
        .max(limits.analysisRanges),
    }),
  ]),
});

export type ContextVideoEvidence = z.infer<typeof evidenceShape>;

function validateSourceBindings(evidence: ContextVideoEvidence, ctx: z.RefinementCtx) {
  const ids = new Set(evidence.sources.map(source => source.versionId.toLowerCase()));
  const references = [
    ...evidence.performers.flatMap(person => person.sourceVersionIds),
    ...(evidence.identity.state === "matched" ? evidence.identity.sourceVersionIds : []),
    ...(evidence.captions.state === "available" ? evidence.captions.sourceVersionIds : []),
    ...(evidence.analysis.state === "available" ? evidence.analysis.sourceVersionIds : []),
  ];
  if (
    ids.size !== evidence.sources.length ||
    references.some(id => !ids.has(id.toLowerCase())) ||
    evidence.sources.some(
      source =>
        source.videoId !== evidence.videoId || source.mediaVersion !== evidence.mediaVersion,
    )
  )
    ctx.addIssue({
      code: "custom",
      message: "Video evidence requires exact retained source/version bindings",
    });
}

function validateAnalyzedRanges(evidence: ContextVideoEvidence, ctx: z.RefinementCtx) {
  const ranges = [
    ...(evidence.captions.state === "available" ? evidence.captions.segments : []),
    ...(evidence.analysis.state === "available" ? evidence.analysis.ranges : []),
  ];
  if (
    ranges.some(
      range =>
        range.endSeconds <= range.startSeconds ||
        (evidence.durationSeconds !== null && range.endSeconds > evidence.durationSeconds),
    )
  )
    ctx.addIssue({ code: "custom", message: "Invalid analyzed video range" });
}

function validateIdentitySeparation(evidence: ContextVideoEvidence, ctx: z.RefinementCtx) {
  const identity = evidence.identity;
  if (
    identity.state === "matched" &&
    (identity.recordingSubjectId.toLowerCase() === evidence.videoSubjectId.toLowerCase() ||
      identity.creditedArtists.some(
        artist =>
          artist.subjectId.toLowerCase() === evidence.videoSubjectId.toLowerCase() ||
          artist.subjectId.toLowerCase() === identity.recordingSubjectId.toLowerCase(),
      ) ||
      new Set(identity.creditedArtists.map(artist => artist.subjectId.toLowerCase())).size !==
        identity.creditedArtists.length)
  )
    ctx.addIssue({
      code: "custom",
      message: "Video, recording and credited artist identities must remain separate",
    });
}

export const contextVideoEvidenceSchema = evidenceShape
  .superRefine(validateSourceBindings)
  .superRefine(validateAnalyzedRanges)
  .superRefine(validateIdentitySeparation);
