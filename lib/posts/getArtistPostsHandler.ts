import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getArtistPosts } from "@/lib/supabase/posts/getArtistPosts";
import { enrichPostWithPlatform } from "@/lib/posts/enrichPostWithPlatform";
import { validateGetArtistPostsRequest } from "@/lib/posts/validateGetArtistPostsRequest";

/**
 * Handler for GET /api/artists/{id}/posts.
 */
export async function getArtistPostsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetArtistPostsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { posts, totalCount } = await getArtistPosts({
      artistAccountId: validated.artist_account_id,
      page: validated.page,
      limit: validated.limit,
    });

    const enriched = posts.map(post => {
      const { social_posts: _sp, ...rest } = enrichPostWithPlatform(post);
      return rest;
    });

    return NextResponse.json(
      {
        status: "success",
        posts: enriched,
        pagination: {
          total_count: totalCount,
          page: validated.page,
          limit: validated.limit,
          total_pages: Math.ceil(totalCount / validated.limit) || 1,
        },
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getArtistPostsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
