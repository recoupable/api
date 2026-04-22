import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectPosts } from "@/lib/supabase/posts/selectPosts";
import { validateGetArtistPostsRequest } from "@/lib/posts/validateGetArtistPostsRequest";

function derivePlatform(profileUrl: string): string {
  if (profileUrl.includes("instagram")) return "INSTAGRAM";
  if (profileUrl.includes("tiktok")) return "TIKTOK";
  if (profileUrl.includes("twitter") || profileUrl.includes("x.com")) return "TWITTER";
  if (profileUrl.includes("spotify")) return "SPOTIFY";
  return "UNKNOWN";
}

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

    const enriched = (
      posts as Array<
        {
          social_posts?: Array<{ social?: { profile_url?: string | null } | null } | null> | null;
        } & Record<string, unknown>
      >
    ).map(post => {
      const { social_posts, ...rest } = post;
      const firstUrl =
        (social_posts ?? []).map(sp => sp?.social?.profile_url ?? "").find(Boolean) ?? "";
      return { ...rest, platform: derivePlatform(firstUrl) };
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
