import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

/**
 * `account_id` is deliberately absent. The owner account is derived from
 * authentication, never from the body -- CLAUDE.md: "Never use `account_id` in
 * request bodies or tool schemas." A body-supplied `account_id` is ignored
 * rather than rejected, so existing callers that still send one keep working;
 * it simply has no effect on attribution.
 */
export const transcribeBodySchema = z.object({
  audio_url: z.string({ message: "audio_url is required" }).url("audio_url must be a valid URL"),
  artist_account_id: z
    .string({ message: "artist_account_id is required" })
    .uuid("artist_account_id must be a valid UUID"),
  title: z.string().optional(),
  include_timestamps: z.boolean().optional(),
});

export interface ValidatedTranscribeRequest {
  audioUrl: string;
  /** Always the authenticated caller — never a body parameter. */
  ownerAccountId: string;
  artistAccountId: string;
  title?: string;
  includeTimestamps?: boolean;
}

/**
 * Validates POST /api/transcribe requests.
 *
 * Transcription is billable work against a third-party provider, so
 * authentication runs before body validation: an unauthenticated caller must
 * not be able to reach the transcription path at all, nor attribute output to
 * an account they do not control.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails, or
 *   the validated transcription parameters with the owner derived from auth.
 */
export async function validateTranscribeRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedTranscribeRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = transcribeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const hasAccess = await canAccessAccount({
    currentAccountId: authResult.accountId,
    targetAccountId: parsed.data.artist_account_id,
  });
  if (!hasAccess) {
    return NextResponse.json(
      { status: "error", error: "Access denied to specified artist_account_id" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return {
    audioUrl: parsed.data.audio_url,
    ownerAccountId: authResult.accountId,
    artistAccountId: parsed.data.artist_account_id,
    title: parsed.data.title,
    includeTimestamps: parsed.data.include_timestamps,
  };
}
