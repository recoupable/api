import { z } from "zod";

// URLs, URI schemes (mailto:, spotify:, file:), drive letters and paths; matches the database check.
const CHANNEL_LINK_PATTERN = /:\/\/|^(?:www\.|\/|\\|~\/)|^[a-z][a-z0-9+.-]*:\S/i;
const CHANNEL_MESSAGE =
  "Channels are names, not links or files; save promoted records first and reference them in promoted";
// Matches the database: control characters are rejected and inner whitespace is collapsed before comparing.
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const channelKey = (value: string) => value.replace(/\s+/g, " ").toLowerCase();

const promotedSubjectSchema = z.strictObject({
  request_id: z.uuid(),
  subject_id: z.uuid(),
});

/**
 * Structured campaign brief accepted by `ingest_campaign_brief`.
 * Promoted entries reference Context requests and subjects the workspace already saved; the database
 * verifies each pair. Raw URLs, file paths and asset references are rejected here, before authorization.
 */
export const campaignBriefSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(200),
    goal: z.string().trim().min(2).max(2000),
    audience: z.string().trim().max(500).optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional(),
    channels: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(60)
          .refine(value => !CONTROL_CHARACTER_PATTERN.test(value), {
            message: "Channel names must not contain control characters",
          })
          .refine(value => !CHANNEL_LINK_PATTERN.test(value), { message: CHANNEL_MESSAGE }),
      )
      .max(10)
      .refine(values => new Set(values.map(channelKey)).size === values.length, {
        message: "Campaign channels must be distinct",
      })
      .optional(),
    promoted: z
      .array(promotedSubjectSchema)
      .max(20)
      .refine(
        values =>
          new Set(values.map(value => `${value.request_id}:${value.subject_id}`.toLowerCase()))
            .size === values.length,
        { message: "Promoted subjects must be distinct" },
      )
      .optional(),
  })
  .refine(value => !value.start_date || !value.end_date || value.end_date >= value.start_date, {
    message: "Campaign end date must not precede start date",
  });

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
