import { z } from "zod";
import { contextIngestSchema } from "./schema";

const submittedTitle = z.string().trim().min(2).max(200);

/**
 * Customer assertions about music that has no external identifier yet. Every object is
 * strict, so an `isrc`, `upc`, `store_ids` or `spotify_id` key is rejected before
 * authorization; identifiers stay unknown until a separate assignment step exists.
 */
export const unreleasedMusicOperationSchemas = [
  z.strictObject({
    action: z.literal("ingest_unreleased_recording"),
    recording: z.strictObject({
      title: submittedTitle,
      working_title: z.string().trim().min(1).max(200).optional(),
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
      lifecycle_state: z.enum([
        "planned",
        "scheduled",
        "announced",
        "delivered",
        "released_unverified",
      ]),
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
            label: z.string().trim().min(1).max(200).optional(),
          }),
        )
        .max(20)
        .optional(),
      promotional_links: z
        .array(
          z.strictObject({
            kind: z.enum(["pre_save", "smart_link", "landing_page", "teaser"]),
            url: z.url({ protocol: /^https?$/ }).max(2048),
          }),
        )
        .max(20)
        .optional(),
      recording_subject_ids: z.array(z.uuid()).max(100).optional(),
    }),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
] as const;
export type UnreleasedMusicOperation = z.infer<(typeof unreleasedMusicOperationSchemas)[number]>;
