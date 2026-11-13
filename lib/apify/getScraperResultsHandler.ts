import { NextRequest, NextResponse } from "next/server";
import { getScraperRunResults } from "@/lib/apify/getScraperRunResults";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetScraperResultsRequest } from "@/lib/apify/validateGetScraperResultsRequest";

/**
 * Handler for GET /api/apify/runs/{runId}.
 *
 * Returns `{ status, dataset_id, data? }`. SUCCEEDED with items → 200 + data.
 * FAILED / ABORTED / SUCCEEDED-without-data → 500. Any other state → 200.
 */
export async function getScraperResultsHandler(
  request: NextRequest,
  runId: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const validated = await validateGetScraperResultsRequest(request, runId);
    if (validated instanceof NextResponse) return validated;

    const { status, dataset_id, data } = await getScraperRunResults(validated.runId);
    if (data) return NextResponse.json({ status, dataset_id, data }, { headers });

    const failed = status === "FAILED" || status === "ABORTED" || status === "SUCCEEDED";
    return NextResponse.json({ status, dataset_id }, { status: failed ? 500 : 200, headers });
  } catch (error) {
    console.error("[ERROR] getScraperResultsHandler:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
