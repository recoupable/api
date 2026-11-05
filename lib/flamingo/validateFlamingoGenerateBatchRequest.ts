import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  flamingoGenerateBatchBodySchema,
  type FlamingoGenerateBatchBody,
} from "@/lib/flamingo/flamingoGenerateBatchBodySchema";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

export interface ValidatedFlamingoGenerateBatchRequest {
  accountId: string;
  body: FlamingoGenerateBatchBody;
}

/**
 * Validates POST /api/songs/analyze/batch end to end, in the same order as
 * `validateFlamingoGenerateRequest`: the JSON body (400), the caller (401
 * from `validateAuthContext`), the body against
 * `flamingoGenerateBatchBodySchema` (400 with `missing_fields`), and finally
 * the one audio URL every prompt shares (422), so no Modal container starts
 * for a batch that cannot be analyzed.
 *
 * @param request - The incoming request.
 * @returns The account and the validated body, or a NextResponse carrying the failure.
 */
export async function validateFlamingoGenerateBatchRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedFlamingoGenerateBatchRequest> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = flamingoGenerateBatchBodySchema.safeParse(raw);
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
