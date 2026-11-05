import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { validateSongMomentsRequest } from "@/lib/songMoments/validateSongMomentsRequest";
import { minimumCreditsForSongMomentsRequest } from "@/lib/songMoments/minimumCreditsForSongMomentsRequest";
import { processSongMomentsRequest } from "@/lib/songMoments/processSongMomentsRequest";

/**
 * Handler for POST /api/songs/moments.
 *
 * Validates the request, gates the balance on the measurement price plus a
 * model base fee per moment that may be described (402 when short), then
 * measures and describes the song (see `processSongMomentsRequest`).
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with the song's sections and moments, or an error.
 */
export async function postSongMomentsHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSongMomentsRequest(request);
  if (validated instanceof NextResponse) return validated;
  const { accountId, body } = validated;

  let short: NextResponse | null;
  try {
    short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: minimumCreditsForSongMomentsRequest(body),
    });
  } catch (err) {
    console.error("[postSongMomentsHandler] credit gate failed:", err);
    return errorResponse("Internal server error", 500);
  }
  if (short) return short;

  try {
    const result = await processSongMomentsRequest(body, { accountId });
    return NextResponse.json(
      { status: "success", ...result },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Song measurement failed";
    return errorResponse(message, 500);
  }
}
