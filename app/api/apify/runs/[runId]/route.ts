import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getScraperResultsHandler } from "@/lib/apify/getScraperResultsHandler";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/apify/runs/{runId}
 *
 * Returns the status (and, on SUCCEEDED, the dataset items) of an Apify actor
 * run. Authentication is required via `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the Apify `runId`.
 * @returns A NextResponse with `{ status, dataset_id, data? }` shape.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return getScraperResultsHandler(request, runId);
}
