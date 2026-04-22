import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectPosts } from "@/lib/supabase/posts/selectPosts";
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

    const { posts, totalCount } = await selectPosts({
      artistAccountId: validated.artist_account_id,
      page: validated.page,
      limit: validated.limit,
    });

    return NextResponse.json(
      {
        status: "success",
        posts,
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
    const msg = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${msg}`, 500);
  }
}
