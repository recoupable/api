import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectPosts } from "@/lib/supabase/posts/selectPosts";
import { validateGetSocialPostsRequest } from "@/lib/posts/validateGetSocialPostsRequest";

/**
 * Handler for GET /api/socials/{id}/posts.
 */
export async function getSocialPostsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetSocialPostsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { posts, totalCount } = await selectPosts({
      socialId: validated.social_id,
      latestFirst: validated.latestFirst,
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
    console.error("[ERROR] getSocialPostsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
