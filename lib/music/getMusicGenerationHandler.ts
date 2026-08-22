import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";
import { toMusicGeneration } from "@/lib/music/toMusicGeneration";
import { fetchMusicLogs } from "@/lib/music/fetchMusicLogs";

/**
 * GET /api/music/{generationId}
 *
 * One generation plus its progress timeline — the endpoint a client polls
 * while a song renders.
 *
 * `logs` are read live from fal through the stored `fal_request_id` and merged
 * into the response, rather than copied into a column of our own. fal is the
 * system that produced them, so storing them would have been a second source
 * of truth that could disagree with the first (recoupable/chat#1992). They are
 * absent from the list read, where the cost would be one fal call per row.
 *
 * Access is checked against the row's owning account rather than filtering the
 * read by the caller, so a generation belonging to someone else is a 403 and a
 * generation that does not exist is a 404. Collapsing both into 404 would hide
 * a real permissions bug behind a plausible-looking "not found".
 *
 * @param request - The incoming request.
 * @param generationId - Generation id from the route segment.
 * @returns `{ status, generation }`.
 */
export async function getMusicGenerationHandler(
  request: NextRequest,
  generationId: string,
): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(generationId).success) {
    return errorResponse("generationId must be a valid UUID", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [row] = await selectMusicGenerations({ id: generationId });
    if (!row) return errorResponse("Music generation not found", 404);

    const allowed = await canAccessAccount({
      currentAccountId: authResult.accountId,
      targetAccountId: row.account_id,
    });
    if (!allowed) return errorResponse("Access denied to this generation", 403);

    const logs = await fetchMusicLogs(row.fal_request_id);

    return successResponse({ generation: { ...toMusicGeneration(row), logs } });
  } catch (error) {
    console.error("Error fetching music generation:", error);
    return errorResponse("Internal server error", 500);
  }
}
