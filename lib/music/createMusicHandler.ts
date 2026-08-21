import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateCreateMusicBody } from "@/lib/music/validateCreateMusicBody";
import { ensureMusicCredits } from "@/lib/music/ensureMusicCredits";
import { startMusicGeneration } from "@/lib/music/startMusicGeneration";
import { toMusicGeneration } from "@/lib/music/toMusicGeneration";

/**
 * POST /api/music
 *
 * Starts a MiniMax Music 3 generation and returns immediately. Generation runs
 * in a workflow for one to two minutes, so this answers 202 with a `pending`
 * generation the client polls, rather than holding the request open.
 *
 * @param request - Incoming request with the generation parameters.
 * @returns 202 with the accepted generation, or the validation, auth, or
 *   credit failure that stopped it.
 */
export async function createMusicHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateMusicBody(request);
  if (validated instanceof NextResponse) return validated;

  const short = await ensureMusicCredits(validated.accountId, validated.duration);
  if (short) return short;

  try {
    const row = await startMusicGeneration(validated);

    return NextResponse.json(
      { status: "success", generation: toMusicGeneration(row) },
      {
        status: 202,
        headers: { ...getCorsHeaders(), Location: `/api/music/${row.id}` },
      },
    );
  } catch (error) {
    console.error("Music generation start error:", error);
    return errorResponse("Internal server error", 500);
  }
}
