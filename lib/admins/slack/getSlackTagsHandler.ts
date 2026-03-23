import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSlackTagsQuery } from "./validateGetSlackTagsQuery";
import { fetchSlackMentions } from "./fetchSlackMentions";

/**
 * Handler for GET /api/admins/coding/slack
 *
 * Returns a list of Slack mentions of the Recoup Coding Agent bot, pulled directly
 * from the Slack API as the source of truth. Supports optional time-period filtering.
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

    const tags = await fetchSlackMentions(query.period);

    return NextResponse.json(
      { status: "success", total: tags.length, tags },
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
