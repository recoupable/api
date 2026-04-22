import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getPosts } from "@/lib/posts/getPosts";
import { validateGetPostsRequest } from "@/lib/posts/validateGetPostsRequest";

/**
 * Handler for GET /api/artists/{id}/posts.
 */
export async function getPostsHandler(request: NextRequest, id: string): Promise<NextResponse> {
  try {
    const validated = await validateGetPostsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getPosts(validated);
    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getPostsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
