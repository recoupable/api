import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSlackTagsQuery } from "./validateGetSlackTagsQuery";
import { fetchSlackMentions } from "./fetchSlackMentions";

/**
 * Handler for GET /api/admins/coding/slack
 *
 * Returns a list of Slack mentions of the Recoup Coding Agent bot, pulled directly
 * from the Slack API as the source of truth. Supports optional time-period and tag filtering.
 *
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status, total, tags }
 */
export async function getSlackTagsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetSlackTagsQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    let tags = await fetchSlackMentions(query.period);

    if (query.tag) {
      tags = tags.filter(t => t.user_id === query.tag);
    }

    const totalPullRequests = tags.reduce((sum, tag) => sum + tag.pull_requests.length, 0);
    const tagsWithPullRequests = tags.filter(tag => tag.pull_requests.length > 0).length;

    return NextResponse.json(
      {
        status: "success",
        total: tags.length,
        total_pull_requests: totalPullRequests,
        tags_with_pull_requests: tagsWithPullRequests,
        tags,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSlackTagsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
