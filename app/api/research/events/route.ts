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
 * POST /api/research/events — List an artist's live shows by Bandsintown artist id.
 * Body: `{ bandsintown_id, date? }`.
 *
 * @param request - JSON body with `bandsintown_id` string
 * @returns JSON `{ status, events }` or error
 */
export async function POST(request: NextRequest) {
  return postResearchEventsHandler(request);
}
