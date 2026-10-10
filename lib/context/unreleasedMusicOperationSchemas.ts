import { z } from "zod";
import { contextIngestSchema } from "./schema";

// Mirrors the database checks so invalid input is a 400, not a failed save: no control
// characters, case-sensitive http(s) scheme, no whitespace and no repeated tracklist slot.
const withoutControlCharacters = /^[^\p{Cc}]*$/u;
const submittedText = (min: number) =>
  z.string().trim().min(min).max(200).regex(withoutControlCharacters);
const submittedTitle = submittedText(2);

/**
 * Customer assertions about music that has no external identifier yet. Every object is
 * strict, so an `isrc`, `upc`, `store_ids` or `spotify_id` key is rejected before
 * authorization; identifiers stay unknown until a separate assignment step exists.
 * An omitted lifecycle is stored as `unknown` for both entries.
 */
export const unreleasedMusicOperationSchemas = [
  z.strictObject({
    action: z.literal("ingest_unreleased_recording"),
    recording: z.strictObject({
      title: submittedTitle,
      working_title: submittedText(1).optional(),
      lifecycle_state: z
        .enum(["idea", "in_production", "mixed", "mastered", "delivered_to_distributor"])
        .optional(),
      planned_release_date: z.iso.date().optional(),
    }),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_planned_release"),
    release: z.strictObject({
      title: submittedTitle,
      lifecycle_state: z
        .enum(["planned", "scheduled", "announced", "delivered", "released_unverified"])
        .optional(),
      planned_release_date: z.iso.date().optional(),
      products: z
        .array(
          z.strictObject({
            format: z.enum([
              "digital_single",
              "digital_ep",
              "digital_album",
              "vinyl",
              "cd",
              "cassette",
            ]),
            label: submittedText(1).optional(),
          }),
        )
        .max(20)
        .optional(),
      promotional_links: z
        .array(
          z.strictObject({
            kind: z.enum(["pre_save", "smart_link", "landing_page", "teaser"]),
            url: z
              .url({ protocol: /^https?$/ })
              .max(2048)
              .regex(/^https?:\/\/[^\s\p{Cc}]+$/u),
          }),
        )
        .max(20)
        .optional(),
      recording_subject_ids: z
        .array(z.uuid())
        .max(100)
        .refine(ids => new Set(ids.map(id => id.toLowerCase())).size === ids.length, {
          message: "A recording may appear only once in a planned release tracklist",
        })
        .optional(),
    }),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
] as const;
export type UnreleasedMusicOperation = z.infer<(typeof unreleasedMusicOperationSchemas)[number]>;
