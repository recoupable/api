import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getOnePredictionHandler } from "@/lib/predictions/getOnePredictionHandler";

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
 * GET /api/predictions/{id}
 *
 * Get a specific engagement prediction by UUID. Returns the full prediction
 * including engagement timeline, peak moments, weak spots, and regional
 * activation data.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the prediction UUID.
 * @returns A NextResponse with the prediction or error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await options.params;
  return getOnePredictionHandler(request, id);
}
