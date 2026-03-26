import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetContentSlackTagsQuery } from "./validateGetContentSlackTagsQuery";
import { fetchContentSlackMentions } from "./fetchContentSlackMentions";

/**
 * Handler for GET /api/admins/content/slack
 *
 * Returns a list of Slack mentions of the Recoup Content Agent bot, pulled directly
 * from the Slack API as the source of truth. Supports optional time-period filtering.
 *
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status, total, tags }
 */
export async function getContentSlackTagsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetContentSlackTagsQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const tags = await fetchContentSlackMentions(query.period);
    const totalVideoLinks = tags.reduce((sum, tag) => sum + tag.video_links.length, 0);
    const tagsWithVideoLinks = tags.filter(tag => tag.video_links.length > 0).length;

    return NextResponse.json(
      {
        status: "success",
        total: tags.length,
        total_video_links: totalVideoLinks,
        tags_with_video_links: tagsWithVideoLinks,
        tags,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getContentSlackTagsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
