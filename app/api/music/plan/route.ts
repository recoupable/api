import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createPlanHandler } from "@/lib/elevenlabs/createPlanHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/plan
 *
 * Create a composition plan from a text prompt.
 * Free — does not consume ElevenLabs credits.
 * Use this before compose to preview and tweak the plan.
 */
export { createPlanHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
