import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postCreatePredictionHandler } from "@/lib/predictions/postCreatePredictionHandler";
import { getListPredictionsHandler } from "@/lib/predictions/getListPredictionsHandler";

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
 * POST /api/predictions
 *
 * Run a neural engagement prediction on video, audio, or text content.
 * Accepts a file URL and modality, returns an engagement score (0-100),
 * timeline, peak moments, weak spots, and regional brain activation data.
 * The result is persisted for later retrieval.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * @param request - The request object containing the JSON body.
 * @returns A NextResponse with the prediction result or error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postCreatePredictionHandler(request);
}

/**
 * GET /api/predictions
 *
 * List past engagement predictions for the authenticated account.
 * Supports limit and offset query parameters for pagination.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * @param request - The request object with optional query params.
 * @returns A NextResponse with the predictions array or error.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getListPredictionsHandler(request);
}
