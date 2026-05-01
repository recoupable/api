import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getScraperResultsHandler } from "@/lib/apify/getScraperResultsHandler";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/apify/runs/{runId} — returns Apify run status and dataset items.
 *
 * @param request - Incoming request.
 * @param ctx - Route context.
 * @param ctx.params - Route params containing `runId`.
 * @returns JSON response with `{ status, dataset_id, data? }`.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  return getScraperResultsHandler(request, runId);
}
