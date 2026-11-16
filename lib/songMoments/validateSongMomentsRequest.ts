import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";
import {
  songMomentsBodySchema,
  type SongMomentsBody,
} from "@/lib/songMoments/songMomentsBodySchema";

export interface ValidatedSongMomentsRequest {
  accountId: string;
  body: SongMomentsBody;
}

/**
 * Validates POST /api/songs/moments the same way /api/songs/analyze is
 * validated: JSON (400), the caller (401), the body (400 with
 * `missing_fields`), then the audio itself (422), so no Modal container
 * starts for a request that cannot be measured.
 *
 * @param request - The incoming request.
 * @returns The account and the validated body, or a NextResponse carrying the failure.
 */
export async function validateSongMomentsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedSongMomentsRequest> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = songMomentsBodySchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return errorResponse(firstError.message, 400, { missing_fields: firstError.path });
  }

  const audio = await verifyAudioUrl(parsed.data.audio_url);
  if (audio.ok === false) {
    return errorResponse(audio.error, 422, { message: audio.message });
  }

  return { accountId: authResult.accountId, body: parsed.data };
}
