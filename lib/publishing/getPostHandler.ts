import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { toPost } from "@/lib/publishing/toPost";

/**
 * GET /api/posts/{id}
 *
 * One post: the polling target while it publishes. Access is checked against
 * the post's account, so someone else's post is a 403 and a missing one a 404,
 * as in getMusicGenerationHandler.
 *
 * @param request - The incoming request.
 * @param id - Post id from the route segment.
 * @returns `{ status, post }`.
 */
export async function getPostHandler(request: NextRequest, id: string): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("id must be a valid UUID", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [row] = await selectScheduledPosts({ id });
    if (!row) return errorResponse("Post not found", 404);

    const allowed = await canAccessAccount({
      currentAccountId: authResult.accountId,
      targetAccountId: row.account_id,
    });
    if (!allowed) return errorResponse("Access denied to this post's account", 403);

    return successResponse({ post: toPost(row) });
  } catch (error) {
    console.error("Error fetching post:", error);
    return errorResponse("Internal server error", 500);
  }
}
