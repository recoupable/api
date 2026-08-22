import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createMusicHandler } from "@/lib/music/createMusicHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music
 *
 * Starts a music generation with MiniMax Music 3 (contract:
 * recoupable/docs#308). Body is validated by `validateCreateMusicBody` in
 * `lib/music/`.
 *
 * @param request - JSON body `{ prompt, lyrics, duration?, seed?,
 *   num_inference_steps?, guidance_scale?, account_id?, organization_id? }`.
 * @returns 202 with the accepted generation and a Location header, 400 on a
 *   bad body, 401 unauthenticated, 402 without credits, 403 on a denied
 *   override, or 500.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createMusicHandler(request);
}

export const dynamic = "force-dynamic";
