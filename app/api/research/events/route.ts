import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchEventsHandler } from "@/lib/research/postResearchEventsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/events — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/events — List a Recoup artist's live shows.
 * Body: `{ artist_id, date? }`.
 *
 * @param request - JSON body with `artist_id` uuid
 * @returns JSON `{ status, events }`, 404 when no events profile is connected, or error
 */
export async function POST(request: NextRequest) {
  return postResearchEventsHandler(request);
}
