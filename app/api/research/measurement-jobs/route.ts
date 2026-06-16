import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createMeasurementJobHandler } from "@/lib/research/measurement_jobs/createMeasurementJobHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/measurement-jobs — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/measurement-jobs — create an async ingest job.
 * `source:"current"` captures present counts; `source:"historical"` enqueues
 * Songstats deep backfill. Body: `{ scope, source, platforms? }`.
 *
 * @param request - body: scope (one of catalog_id/album_ids/isrcs) + source
 * @returns 202 JSON job payload or error
 */
export async function POST(request: NextRequest) {
  return createMeasurementJobHandler(request);
}
