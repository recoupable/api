import { z } from "zod";
import { countXWeightedLength } from "@/lib/publishing/countXWeightedLength";
import {
  INSTAGRAM_CAPTION_MAX,
  LINKEDIN_COMMENTARY_MAX,
  POST_PLATFORMS,
  X_TEXT_MAX,
  YOUTUBE_DESCRIPTION_MAX,
  YOUTUBE_TITLE_MAX,
  type PostPlatform,
} from "@/lib/publishing/const";

const nonBlank = z.string().refine(value => value.trim().length > 0, "must not be blank");

// Fields a platform does not use. Rejected rather than dropped, so a caller
// never believes a privacy setting or cover applied when it did not.
const UNUSED_FIELDS: Record<
  PostPlatform,
  Array<"title" | "cover_url" | "privacy" | "tags" | "sub_account_id">
> = {
  youtube: ["cover_url", "sub_account_id"],
  instagram: ["title", "privacy", "tags", "sub_account_id"],
  x: ["title", "cover_url", "privacy", "tags", "sub_account_id"],
  linkedin: ["privacy", "tags"],
};

/**
 * Strict for the same reason as createMusicBodySchema: an unknown key fails
 * loudly instead of silently changing what gets posted.
 */
export const createPostBodySchema = z
  .strictObject({
    account_id: z.string().uuid().optional(),
    platform: z.enum(POST_PLATFORMS),
    sub_account_id: nonBlank.optional(),
    video_url: z.string().url(),
    cover_url: z.string().url().optional(),
    title: nonBlank.optional(),
    description: nonBlank.optional(),
    privacy: z.enum(["public", "unlisted", "private"]).optional(),
    tags: z.array(nonBlank).optional(),
    publish_at: z
      .string()
      .datetime({ offset: true })
      .refine(value => Date.parse(value) > Date.now(), "publish_at must be in the future")
      .optional(),
  })
  .superRefine((body, ctx) => {
    for (const field of UNUSED_FIELDS[body.platform]) {
      if (body[field] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is not used for ${body.platform}`,
        });
      }
    }

    if (body.platform === "youtube") {
      if (!body.title) {
        ctx.addIssue({ code: "custom", path: ["title"], message: "title is required for youtube" });
      } else if (body.title.length > YOUTUBE_TITLE_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["title"],
          message: `title exceeds ${YOUTUBE_TITLE_MAX} characters`,
        });
      }
      if (body.description && body.description.length > YOUTUBE_DESCRIPTION_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["description"],
          message: `description exceeds ${YOUTUBE_DESCRIPTION_MAX} characters`,
        });
      }
      return;
    }

    if (!body.description) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: `description is required for ${body.platform}`,
      });
      return;
    }
    const over =
      body.platform === "x"
        ? countXWeightedLength(body.description) > X_TEXT_MAX && `${X_TEXT_MAX} weighted characters`
        : body.platform === "instagram"
          ? body.description.length > INSTAGRAM_CAPTION_MAX && `${INSTAGRAM_CAPTION_MAX} characters`
          : body.description.length > LINKEDIN_COMMENTARY_MAX &&
            `${LINKEDIN_COMMENTARY_MAX} characters`;
    if (over) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: `description exceeds ${over}`,
      });
    }
  });

export type CreatePostBody = z.infer<typeof createPostBodySchema>;
