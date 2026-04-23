import { NextRequest, NextResponse } from "next/server";
import apifyClient from "@/lib/apify/client";
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

    const run = await apifyClient.run(validated.runId).get();
    const status = run?.status ?? "UNKNOWN";
    const dataset_id = run?.defaultDatasetId ?? null;

    if (status === "SUCCEEDED" && dataset_id) {
      const result = await apifyClient.dataset(dataset_id).listItems();
      if (result?.items) {
        return NextResponse.json({ status, dataset_id, data: result.items }, { headers });
      }
    }

    const failed = status === "FAILED" || status === "ABORTED" || status === "SUCCEEDED";
    return NextResponse.json({ status, dataset_id }, { status: failed ? 500 : 200, headers });
  } catch (error) {
    console.error("[ERROR] getScraperResultsHandler:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}

export default getScraperResultsHandler;
