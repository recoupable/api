import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetCodingPrQuery } from "./validateGetCodingPrQuery";
import { fetchGithubPrStatus } from "@/lib/github/fetchGithubPrStatus";

/**
 * Handler for GET /api/admins/coding/pr
 *
 * Returns the status (open, closed, or merged) for each provided GitHub PR URL.
 * Uses the GitHub REST API to check each PR's state.
 *
 * Requires admin authentication.
 *
 * @param request
 */
export async function getPrStatusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetCodingPrQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const results = await Promise.all(
      query.pull_requests.map(async url => ({
        url,
        status: await fetchGithubPrStatus(url),
      })),
    );

    return NextResponse.json(
      {
        status: "success",
        pull_requests: results,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getPrStatusHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
