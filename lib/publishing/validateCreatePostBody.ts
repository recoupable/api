import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createPostBodySchema, type CreatePostBody } from "@/lib/publishing/createPostBodySchema";

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
    return errorResponse(
      unknownKeys.length ? `Unrecognized field(s): ${unknownKeys.join(", ")}` : firstError.message,
      400,
      { missing_fields: unknownKeys.length ? unknownKeys : firstError.path },
    );
  }

  if (result.data.publish_at !== undefined) {
    return errorResponse("Scheduling is not available yet; omit publish_at to publish now", 400, {
      missing_fields: ["publish_at"],
    });
  }

  const authResult = await validateAuthContext(request, {
    accountId: result.data.account_id,
  });
  if (authResult instanceof NextResponse) return authResult;

  return { accountId: authResult.accountId, ...result.data };
}
