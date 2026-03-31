import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getFlamingoPresetsHandler } from "@/lib/flamingo/getFlamingoPresetsHandler";

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
 * GET /api/songs/analyze/presets
 *
 * Lists all available music analysis presets. Each preset is a curated
 * prompt with optimized generation parameters for a specific use case
 * (e.g. catalog metadata, sync licensing, audience profiling).
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Response (200):
 * - status: "success"
 * - presets: Array of { name, label, description, requiresAudio, responseFormat }
 *
 * @param request - The incoming request with authentication headers
 * @returns A NextResponse with the list of available presets
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getFlamingoPresetsHandler(request);
}
