import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getActorStatus } from "@/lib/apify/getActorStatus";
import { getDataset } from "@/lib/apify/getDataset";
import { validateGetScraperResultsRequest } from "@/lib/apify/validateGetScraperResultsRequest";

/**
 * Handler for GET /api/apify/runs/{runId}.
 *
 * Fetches the Apify run status, and on SUCCEEDED additionally fetches the
 * default dataset items. Response bodies use snake_case `dataset_id` — this is
 * a deliberate wire-format change vs. the legacy Express route which emitted
 * `datasetId`; the two hosts do not coexist for the same client so there is no
 * compatibility concern.
 *
 * Status map:
 * - `RUNNING` / `READY` / other in-progress → 200 `{ status, dataset_id }`
 * - `SUCCEEDED` with `dataset_id` → 200 `{ status, dataset_id, data }`
 * - `SUCCEEDED` without `dataset_id` → 500 (should not happen for real runs)
 * - `FAILED` / `ABORTED` → 500 `{ status, dataset_id }`
 * - Any thrown error → 500 `{ error: "Internal server error" }`
 *
 * @param request - The incoming request.
 * @param runId - The Apify run identifier from the route params.
 * @returns A `NextResponse` describing the run state or its dataset items.
 */
export async function getScraperResultsHandler(
  request: NextRequest,
  runId: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetScraperResultsRequest(request, runId);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { status, dataset_id } = await getActorStatus(validated.runId);

    if (status === "SUCCEEDED") {
      if (!dataset_id) {
        return NextResponse.json(
          { status, dataset_id },
          { status: 500, headers: getCorsHeaders() },
        );
      }
      const data = await getDataset(dataset_id);
      if (data === null) {
        return NextResponse.json(
          { status, dataset_id },
          { status: 500, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { status, dataset_id, data },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    if (status === "FAILED" || status === "ABORTED") {
      return NextResponse.json({ status, dataset_id }, { status: 500, headers: getCorsHeaders() });
    }

    return NextResponse.json({ status, dataset_id }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getScraperResultsHandler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

export default getScraperResultsHandler;
