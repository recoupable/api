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
 * GET /api/music/presets
 *
 * Lists all available music analysis presets. Each preset is a curated
 * prompt with optimized generation parameters for a specific use case
 * (e.g. catalog metadata, sync licensing, audience profiling).
 *
 * No authentication required — this is a discovery endpoint.
 *
 * Response (200):
 * - status: "success"
 * - presets: Array of { name, label, description, requiresAudio, responseFormat }
 *
 * @returns A NextResponse with the list of available presets
 */
export async function GET(): Promise<NextResponse> {
  return getFlamingoPresetsHandler();
}
