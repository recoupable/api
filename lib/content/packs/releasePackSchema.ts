import { z } from "zod";
import { isSafeHttpUrl } from "@/lib/arweave/isSafeHttpUrl";

const text = z.string().trim().min(1).max(2000);
const mediaUrl = z
  .string()
  .url()
  .max(4000)
  .refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && isSafeHttpUrl(value);
  }, "Use an HTTPS media URL on a public host");
const date = z.iso
  .date()
  .refine(
    value => new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    "Invalid date",
  );

const creativeId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const creativeContextSchema = z
  .strictObject({
    starting_point: z.enum(["established", "rough_idea", "none"]),
    working_mode: z.enum(["autonomous", "guided"]).default("autonomous"),
    references: z
      .array(
        z.strictObject({
          id: creativeId,
          title: text,
          url: mediaUrl,
          media_type: z.enum(["image", "document", "link"]),
          source_kind: z.enum(["recoup", "customer", "public", "generated"]),
          usage: z.enum(["reference_only", "production"]).default("reference_only"),
        }),
      )
      .max(20)
      .default([]),
    directions: z
      .array(
        z.strictObject({
          id: creativeId,
          name: z.string().trim().min(1).max(120),
          concept: z.string().trim().min(1).max(1200),
          palette: z.array(z.string().trim().min(1).max(48)).max(8).default([]),
          typography: z.string().trim().min(1).max(200).optional(),
          reference_ids: z.array(creativeId).max(20).default([]),
          board_url: mediaUrl.optional(),
        }),
      )
      .max(3)
      .default([]),
    selection: z
      .strictObject({
        direction_id: creativeId,
        selected_by: z.enum(["customer", "agent"]),
        decision_note: text,
      })
      .optional(),
  })
  .superRefine((context, ctx) => {
    const referenceIds = new Set(context.references.map(reference => reference.id));
    const directionIds = new Set(context.directions.map(direction => direction.id));
    if (referenceIds.size !== context.references.length)
      ctx.addIssue({
        code: "custom",
        path: ["references"],
        message: "Reference ids must be unique",
      });
    if (directionIds.size !== context.directions.length)
      ctx.addIssue({
        code: "custom",
        path: ["directions"],
        message: "Direction ids must be unique",
      });
    context.references.forEach((reference, index) => {
      if (reference.usage === "production" && reference.media_type !== "image")
        ctx.addIssue({
          code: "custom",
          path: ["references", index, "usage"],
          message: "Only image references can be selected as production image inputs",
        });
    });
    context.directions.forEach((direction, index) => {
      if (
        new Set(direction.reference_ids).size !== direction.reference_ids.length ||
        direction.reference_ids.some(id => !referenceIds.has(id))
      )
        ctx.addIssue({
          code: "custom",
          path: ["directions", index, "reference_ids"],
          message: "Direction reference ids must be distinct references in this brief",
        });
    });
    if (context.selection && !directionIds.has(context.selection.direction_id))
      ctx.addIssue({
        code: "custom",
        path: ["selection", "direction_id"],
        message: "Select a direction saved in this same brief",
      });
  });

export const releasePackBriefSchema = z
  .strictObject({
    artist_name: text.optional(),
    artist_account_id: z.uuid().optional(),
    song_title: text.optional(),
    recording_version: text.optional(),
    audio_url: mediaUrl.optional(),
    audio_start_seconds: z.number().min(0).max(1200).optional(),
    occasion: z.enum(["new_release", "anniversary", "reissue", "remix", "rediscovery"]).optional(),
    original_release_date: date.optional(),
    campaign_date: date.optional(),
    primary_action: text.default("listen"),
    destination_url: mediaUrl.optional(),
    audience: text.optional(),
    song_summary: text.optional(),
    lyrics_excerpt: z.string().trim().max(1000).optional(),
    creative_direction: text.optional(),
    creative_context: creativeContextSchema.optional(),
    allow_creative_defaults: z.boolean().default(false),
    reference_image_urls: z.array(mediaUrl).max(5).default([]),
    constraints: z.array(text).max(12).default([]),
    platforms: z
      .array(z.enum(["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"]))
      .min(1)
      .max(6)
      .default(["instagram", "tiktok"]),
    context_brief_id: z.uuid().optional(),
    evidence: z
      .array(
        z.strictObject({
          text,
          kind: z.enum(["customer_assertion", "source_observation", "creative_proposal"]),
          source_url: mediaUrl.optional(),
        }),
      )
      .max(20)
      .default([]),
  })
  .superRefine((brief, ctx) => {
    const context = brief.creative_context;
    const selected = context?.directions.find(
      direction => direction.id === context.selection?.direction_id,
    );
    const production =
      context?.references
        .filter(
          reference =>
            selected?.reference_ids.includes(reference.id) && reference.usage === "production",
        )
        .map(reference => reference.url) ?? [];
    if (new Set([...brief.reference_image_urls, ...production]).size > 5)
      ctx.addIssue({
        code: "custom",
        path: ["creative_context", "selection"],
        message: "A pack may use at most five distinct production image references",
      });
  });

export type ReleasePackBrief = z.infer<typeof releasePackBriefSchema>;

export const releasePackAssetKinds = [
  "video",
  "artwork",
  "quote_card",
  "carousel",
  "visualizer",
] as const;
export const releasePackDeliverablesSchema = z
  .strictObject({
    videos: z.number().int().min(0).max(12).default(8),
    quote_cards: z.number().int().min(0).max(8).default(4),
    artwork: z.number().int().min(0).max(2).default(1),
    carousels: z.number().int().min(0).max(2).default(1),
    visualizers: z.number().int().min(0).max(3).default(1),
    video_seconds: z.number().int().min(5).max(15).default(8),
  })
  .refine(value => {
    const count =
      value.videos + value.quote_cards + value.artwork + value.carousels + value.visualizers;
    return count >= 1 && count <= 30;
  }, "Request between 1 and 30 creative pieces; a carousel counts as one piece");

export type ReleasePackDeliverables = z.infer<typeof releasePackDeliverablesSchema>;

export const releasePackStatusSchema = z.enum([
  "draft",
  "needs_input",
  "ready_to_quote",
  "awaiting_approval",
  "running",
  "partial",
  "completed",
  "failed",
  "canceled",
]);

export const prepareReleasePackSchema = z.strictObject({
  job_id: z.uuid().optional(),
  organization_id: z.uuid().optional(),
  expected_revision: z.number().int().positive().optional(),
  idempotency_key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9._:-]+$/),
  brief: releasePackBriefSchema,
  deliverables: releasePackDeliverablesSchema.default({
    videos: 8,
    quote_cards: 4,
    artwork: 1,
    carousels: 1,
    visualizers: 1,
    video_seconds: 8,
  }),
});

export const releasePackLocatorSchema = z.strictObject({
  job_id: z.uuid(),
  organization_id: z.uuid().optional(),
});

export const approveReleasePackSchema = releasePackLocatorSchema.extend({
  quote_id: z.uuid(),
  expected_revision: z.number().int().positive(),
  approved_max_usd: z.number().positive().max(100),
});

export const retryReleasePackSchema = approveReleasePackSchema.extend({
  asset_id: z.uuid(),
});

export const uploadPackAssetSchema = z.strictObject({
  organization_id: z.uuid().optional(),
  filename: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9._ -]+$/)
    .optional(),
  content_type: z
    .enum([
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/mp4",
      "image/png",
      "image/jpeg",
      "image/webp",
    ])
    .optional(),
  mode: z.enum(["inline", "signed_url", "finalize"]).default("inline"),
  base64: z.string().min(4).max(4_000_000).optional(),
  source_url: mediaUrl.optional(),
  storage_key: z.string().min(1).max(400).optional(),
  file: z
    .strictObject({
      download_url: mediaUrl,
      file_id: z.string().min(1).max(2000),
      mime_type: z.string().max(200).optional(),
      file_name: z.string().max(300).optional(),
    })
    .optional(),
});

export const estimateReleasePackSchema = releasePackLocatorSchema.extend({
  asset_id: z
    .uuid()
    .optional()
    .describe(
      "Quote a fresh paid attempt only for this confirmed failed asset. Omit for the initial complete pack quote.",
    ),
});
