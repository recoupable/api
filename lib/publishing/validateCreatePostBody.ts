import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
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
    publish_at: z.string().datetime({ offset: true }).optional(),
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

export type ValidatedCreatePostBody = {
  accountId: string;
} & CreatePostBody;

/**
 * Validates auth and request body for POST /api/posts.
 *
 * Parsed before auth so a malformed body fails as a 400 without an API-key
 * lookup; `account_id` reaches `validateAuthContext` only as an override.
 *
 * Publish-now only: `publish_at` is part of the published contract but its
 * scheduling ships in a follow-up (recoupable/app#2241), so it is rejected here
 * rather than accepted and ignored.
 *
 * @param request - Incoming request carrying the post.
 * @returns The validated body plus the resolved account, or a NextResponse the
 *   caller returns as-is (400, 401, or 403).
 */
export async function validateCreatePostBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreatePostBody> {
  const body = await safeParseJson(request);
  const result = createPostBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    const unknownKeys =
      firstError.code === "unrecognized_keys" ? (firstError as { keys: string[] }).keys : [];
    return badRequest(
      unknownKeys.length ? unknownKeys : firstError.path,
      unknownKeys.length ? `Unrecognized field(s): ${unknownKeys.join(", ")}` : firstError.message,
    );
  }

  if (result.data.publish_at !== undefined) {
    return badRequest(
      ["publish_at"],
      "Scheduling is not available yet; omit publish_at to publish now",
    );
  }

  const authResult = await validateAuthContext(request, {
    accountId: result.data.account_id,
  });
  if (authResult instanceof NextResponse) return authResult;

  return { accountId: authResult.accountId, ...result.data };
}

/**
 * The standard 400 envelope.
 *
 * @param path - Path segments of the offending field.
 * @param error - Human-readable message.
 * @returns The 400 response.
 */
function badRequest(path: PropertyKey[], error: string): NextResponse {
  return NextResponse.json(
    { status: "error", missing_fields: path, error },
    { status: 400, headers: getCorsHeaders() },
  );
}
