import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";
import { validateGetMusicQuery } from "@/lib/music/validateGetMusicQuery";
import { toMusicGeneration } from "@/lib/music/toMusicGeneration";

/**
 * GET /api/music
 *
 * The account's music generations, newest first. `account_id` is a scoped
 * override, validated by `validateAuthContext` — a caller who cannot reach the
 * target account gets a 403 rather than an empty list.
 *
 * `logs` is deliberately absent from this response: the gallery renders dozens
 * of rows and none of them need a timeline. It comes back on the single read.
 *
 * @param request - The request carrying the query parameters.
 * @returns `{ status, generations }`.
 */
export async function getMusicHandler(request: NextRequest): Promise<NextResponse> {
  const validated = validateGetMusicQuery(request.nextUrl.searchParams);
  if (validated instanceof NextResponse) return validated;

  const authResult = await validateAuthContext(request, {
    accountId: validated.account_id,
  });
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Throws on query error rather than returning []: a database failure must
    // never read to the caller as "you have never generated a song".
    const rows = await selectMusicGenerations({
      accountId: authResult.accountId,
      status: validated.status,
      limit: validated.limit,
      offset: validated.offset,
    });

    return successResponse({ generations: rows.map(toMusicGeneration) });
  } catch (error) {
    console.error("Error fetching music generations:", error);
    return errorResponse("Internal server error", 500);
  }
}
