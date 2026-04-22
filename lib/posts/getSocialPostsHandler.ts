import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getSocialPosts } from "@/lib/posts/getSocialPosts";
import { validateGetSocialPostsRequest } from "@/lib/posts/validateGetSocialPostsRequest";

export async function getSocialPostsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetSocialPostsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getSocialPosts(validated);

    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getSocialPostsHandler:", error);
    // Never surface raw error messages — leaks connection details and stack hints.
    return errorResponse("Internal server error", 500);
  }
}
