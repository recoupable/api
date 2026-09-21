import { z } from "zod";
import { parseContextUrl } from "./parseContextUrl";

export const contextTopicSchema = z.enum([
  "release_metadata",
  "artist_metadata",
  "catalog_metadata",
  "lyrics",
  "song_summary",
  "artwork_branding",
  "artist_research",
  "artist_brand",
  "era",
  "video_narrative",
]);

export const contextIngestSchema = z.strictObject({
  url: z
    .string()
    .url()
    .max(2048)
    .refine(value => {
      try {
        parseContextUrl(value);
        return true;
      } catch {
        return false;
      }
    }, "Use a Spotify track or a single YouTube video URL"),
  idempotency_key: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
  organization_id: z.string().uuid().optional(),
  topics: z.array(contextTopicSchema).min(1).max(10).optional(),
  direction: z.string().max(4000).optional(),
});

export const contextCoverageSchema = z
  .strictObject({
    extent: z.enum(["full", "partial", "unknown", "unavailable"]),
    identity: z.enum(["matched", "uncertain", "mismatch", "unknown"]),
    durationSeconds: z.number().positive().finite().nullable(),
    startSeconds: z.number().nonnegative().finite().nullable(),
    endSeconds: z.number().nonnegative().finite().nullable(),
    language: z.string().min(1).max(100).nullable(),
  })
  .superRefine((value, ctx) => {
    const { startSeconds: start, endSeconds: end, durationSeconds: duration } = value;
    if (
      (start === null) !== (end === null) ||
      (start !== null && end !== null && end <= start) ||
      (duration !== null && end !== null && end > duration)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid analyzed media range" });
    }
    if (
      value.extent === "full" &&
      (value.identity !== "matched" || duration === null || start !== 0 || end !== duration)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Full coverage requires a matched recording and its complete known range",
      });
    }
  });

export const contextEvidenceKindSchema = z.enum([
  "observation",
  "estimate",
  "interpretation",
  "customer_assertion",
  "creative_proposal",
]);
export const contextResultStatusSchema = z.enum([
  "queued",
  "running",
  "fetched",
  "invalid",
  "partial",
  "accepted",
  "unavailable",
  "failed",
  "stale",
  "withdrawn",
]);

export type ContextIngestInput = z.infer<typeof contextIngestSchema>;
export type ContextCoverage = z.infer<typeof contextCoverageSchema>;
