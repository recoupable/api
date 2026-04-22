import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getArtistPosts } from "@/lib/posts/getArtistPosts";
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

    const result = await getArtistPosts(validated);
    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getArtistPostsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
