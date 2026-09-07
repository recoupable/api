import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  flamingoGenerateBodySchema,
  type FlamingoGenerateBody,
} from "@/lib/flamingo/flamingoGenerateBodySchema";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

export interface ValidatedFlamingoGenerateRequest {
  accountId: string;
  body: FlamingoGenerateBody;
}

function reject(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json({ status: "error", ...body }, { status, headers: getCorsHeaders() });
}

/**
 * Validates POST /api/songs/analyze end to end: the JSON body (400), the
 * caller (401 from `validateAuthContext`), the body against
 * `flamingoGenerateBodySchema` (400 with `missing_fields`), and finally the
 * audio itself (422, documented as `SongAnalyzeAudioUrlErrorResponse`), so no
 * Modal container starts for a request that cannot be analyzed
 * (recoupable/app#2061). `full_report` verifies its one URL once here.
 *
 * @param request - The incoming request.
 * @returns The account and the validated body, or a NextResponse carrying the failure.
 */
export async function validateFlamingoGenerateRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedFlamingoGenerateRequest> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return reject({ error: "Request body must be valid JSON" }, 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = flamingoGenerateBodySchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return reject({ missing_fields: firstError.path, error: firstError.message }, 400);
  }

  const audio = await verifyAudioUrl(parsed.data.audio_url);
  if (audio.ok === false) {
    return reject({ error: audio.error, message: audio.message }, 422);
  }

  return { accountId: authResult.accountId, body: parsed.data };
}
