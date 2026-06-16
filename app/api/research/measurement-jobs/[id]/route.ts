import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getMeasurementJobHandler } from "@/lib/research/measurement_jobs/getMeasurementJobHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/measurement-jobs/{id} — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/measurement-jobs/{id} — poll a `current` measurement job.
 *
 * @param request - The incoming HTTP request.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the job id.
 * @returns JSON job status or error
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getMeasurementJobHandler(request, id);
}
