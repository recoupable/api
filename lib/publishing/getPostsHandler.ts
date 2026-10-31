import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { validateGetPostsQuery } from "@/lib/publishing/validateGetPostsQuery";
import { toPost } from "@/lib/publishing/toPost";

/**
 * GET /api/posts
 *
 * The account's posts, newest first. `account_id` is a scoped override: a
 * caller who cannot reach the account gets a 403, not an empty list.
 *
 * @param request - The request carrying the query parameters.
 * @returns `{ status, posts }`.
 */
export async function getPostsHandler(request: NextRequest): Promise<NextResponse> {
  const validated = validateGetPostsQuery(request.nextUrl.searchParams);
  if (validated instanceof NextResponse) return validated;

  const authResult = await validateAuthContext(request, { accountId: validated.account_id });
  if (authResult instanceof NextResponse) return authResult;

  try {
    const rows = await selectScheduledPosts({
      accountId: authResult.accountId,
      artistAccountId: validated.artist_account_id,
      status: validated.status,
      platform: validated.platform,
      limit: validated.limit,
      offset: validated.offset,
    });

    return successResponse({ posts: rows.map(toPost) });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return errorResponse("Internal server error", 500);
  }
}
