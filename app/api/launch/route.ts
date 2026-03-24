import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateCampaignHandler } from "@/lib/launch/generateCampaignHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns Empty 200 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/launch
 *
 * Streams an AI-generated music release campaign given artist and song details.
 * Returns a text/plain stream with XML-style section markers that the client
 * parses to render each campaign section in real-time.
 *
 * Authentication: x-api-key header OR Authorization: Bearer token required.
 *
 * Request body:
 * - artist_name: string (required) — the artist's name
 * - song_name: string (required) — the song or album name
 * - genre: string (required) — musical genre
 * - release_date: string (required) — release date (any format)
 * - description: string (optional) — additional context for the AI
 *
 * Response: streaming text with section markers:
 *   [SECTION:press_release]...[/SECTION:press_release]
 *   [SECTION:spotify_pitch]...[/SECTION:spotify_pitch]
 *   [SECTION:instagram_captions]...[/SECTION:instagram_captions]
 *   [SECTION:tiktok_hooks]...[/SECTION:tiktok_hooks]
 *   [SECTION:fan_newsletter]...[/SECTION:fan_newsletter]
 *   [SECTION:curator_email]...[/SECTION:curator_email]
 *
 * @param request - The incoming request
 * @returns Streaming text response or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return generateCampaignHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
