import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { parseLinkedInPostUrn } from "@/lib/publishing/stats/parseLinkedInPostUrn";
import { getLinkedInPostStats } from "@/lib/publishing/stats/getLinkedInPostStats";

const ORGANIZATION_PREFIX = "urn:li:organization:";

/**
 * GET /api/posts/{id}/stats
 *
 * A published post's own platform numbers, read live through the connection
 * that published it. LinkedIn company-page posts only; other platforms and
 * member posts answer 422. Reads cost no credits. Uuid, auth and access checks
 * match getPostHandler.
 *
 * @param request - The incoming request.
 * @param id - Post id from the route segment.
 * @returns `{ status, stats }`.
 */
export async function getPostStatsHandler(request: NextRequest, id: string): Promise<NextResponse> {
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

    if (row.status !== "posted" || !row.post_url) {
      return errorResponse("Post is not published yet, so it has no stats", 409);
    }
    if (row.platform !== "linkedin") {
      return errorResponse(`Stats are not available for ${row.platform} posts yet`, 422);
    }
    const organization = row.sub_account_id;
    if (!organization?.startsWith(ORGANIZATION_PREFIX)) {
      return errorResponse("Stats are available for LinkedIn company-page posts only", 422);
    }
    const post = parseLinkedInPostUrn(row.post_url);
    if (!post) return errorResponse("post_url does not name a LinkedIn post", 422);

    const connectedAccountId = await findConnectedAccountId(
      row.artist_account_id ?? row.account_id,
      "linkedin",
    );
    if (!connectedAccountId) {
      return errorResponse("linkedin is not connected for this account", 409);
    }

    let metrics;
    try {
      metrics = await getLinkedInPostStats(connectedAccountId, organization, post);
    } catch (error) {
      console.error("LinkedIn rejected the post stats read:", error);
      return errorResponse("LinkedIn rejected the stats read for this post", 502);
    }

    return successResponse({
      stats: {
        post_id: row.id,
        platform: row.platform,
        post_url: row.post_url,
        ...metrics,
        as_of: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching post stats:", error);
    return errorResponse("Internal server error", 500);
  }
}
