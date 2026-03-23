import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetCodingPrQuery } from "./validateGetCodingPrQuery";
import { fetchGithubPrMergedStatus } from "./fetchGithubPrMergedStatus";

/**
 * Handler for GET /api/admins/coding/pr
 *
 * Returns the merged status for each provided GitHub pull request URL.
 * Uses the GitHub REST API to check merge status for each PR.
 *
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status, pull_requests: [{ url, merged }] }
 */
export async function getPrMergedStatusHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetCodingPrQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const results = await Promise.all(
      query.pull_requests.map(async url => ({
        url,
        merged: await fetchGithubPrMergedStatus(url),
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
    console.error("[ERROR] getPrMergedStatusHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
