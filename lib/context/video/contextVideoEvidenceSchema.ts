import { z } from "zod";

const text = z
  .string()
  .min(1)
  .max(4000)
  .refine(value => /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value));
const references = z
  .array(z.uuid())
  .min(1)
  .max(32)
  .refine(ids => new Set(ids).size === ids.length);
const range = {
  startSeconds: z.number().nonnegative().finite(),
  endSeconds: z.number().positive().finite(),
};
const unavailable = z.strictObject({ state: z.enum(["missing", "unavailable"]), reason: text });

/** Retained, authorized evidence supplied by an injected reader; never a public identity assertion. */
export const contextVideoEvidenceSchema = z
  .strictObject({
    requestId: z.uuid(),
    ownerId: z.uuid(),
    videoSubjectId: z.uuid(),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    mediaVersion: text,
    durationSeconds: z.number().positive().finite().nullable(),
    variant: z.enum(["original", "live", "remix", "dubbed", "unknown"]),
    title: text,
    description: z.string().max(20000),
    channel: z.strictObject({ id: text, name: text }),
    performers: z.array(z.strictObject({ name: text, sourceVersionIds: references })).max(50),
    identity: z.discriminatedUnion("state", [
      z.strictObject({ state: z.literal("unresolved"), reason: text }),
      z.strictObject({
        state: z.literal("matched"),
        recordingSubjectId: z.uuid(),
        creditedArtists: z
          .array(z.strictObject({ subjectId: z.uuid(), name: text }))
          .min(1)
          .max(50),
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
      .max(32),
    captions: z.union([
      unavailable,
      z.strictObject({
        state: z.literal("available"),
        sourceVersionIds: references,
        segments: z
          .array(z.strictObject({ ...range, language: z.string().min(1).max(100), text }))
          .min(1)
          .max(500),
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
              observations: z.array(text).min(1).max(50),
              interpretation: text,
            }),
          )
          .min(1)
          .max(100),
      }),
    ]),
  })
  .superRefine((evidence, ctx) => {
    const ids = new Set(evidence.sources.map(source => source.versionId));
    const references = [
      ...evidence.performers.flatMap(person => person.sourceVersionIds),
      ...(evidence.identity.state === "matched" ? evidence.identity.sourceVersionIds : []),
      ...(evidence.captions.state === "available" ? evidence.captions.sourceVersionIds : []),
      ...(evidence.analysis.state === "available" ? evidence.analysis.sourceVersionIds : []),
    ];
    const ranges = [
      ...(evidence.captions.state === "available" ? evidence.captions.segments : []),
      ...(evidence.analysis.state === "available" ? evidence.analysis.ranges : []),
    ];
    if (
      ids.size !== evidence.sources.length ||
      references.some(id => !ids.has(id)) ||
      evidence.sources.some(
        source =>
          source.videoId !== evidence.videoId || source.mediaVersion !== evidence.mediaVersion,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Video evidence requires exact retained source/version bindings",
      });
    if (
      ranges.some(
        range =>
          range.endSeconds <= range.startSeconds ||
          (evidence.durationSeconds !== null && range.endSeconds > evidence.durationSeconds),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid analyzed video range" });
    const identity = evidence.identity;
    if (
      identity.state === "matched" &&
      (identity.recordingSubjectId === evidence.videoSubjectId ||
        identity.creditedArtists.some(
          artist =>
            artist.subjectId === evidence.videoSubjectId ||
            artist.subjectId === identity.recordingSubjectId,
        ) ||
        new Set(identity.creditedArtists.map(artist => artist.subjectId)).size !==
          identity.creditedArtists.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Video, recording and credited artist identities must remain separate",
      });
  });
