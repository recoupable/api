import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

// Ranges mirror the fal minimax/music-3 form, except the duration floor: fal
// allows 1 second, we floor at 10 because a shorter request costs a full
// workflow run and cannot produce a usable song.
/**
 * Strict on purpose. Zod drops unknown keys by default, which meant a body
 * carrying `organization_id` returned 200 with the song filed under the
 * caller's personal account and nothing to say the field was ignored —
 * chat#1994 shipped exactly that and it had to be found by inspection. A
 * misspelled or imagined field should fail loudly rather than quietly change
 * where the song lands.
 */
export const createMusicBodySchema = z.strictObject({
  prompt: z.string().min(1),
  lyrics: z.string().min(1),
  duration: z.number().min(10).max(300).default(60),
  seed: z.number().int().optional(),
  num_inference_steps: z.number().int().min(1).max(100).default(30),
  guidance_scale: z.number().min(0).max(20).default(1.7),
  account_id: z.string().uuid().optional(),
});

export type ValidatedCreateMusicBody = {
  accountId: string;
} & z.infer<typeof createMusicBodySchema>;

/**
 * Validates auth and request body for POST /api/music.
 *
 * The body is parsed before auth so a malformed request fails as a 400 rather
 * than spending an API-key lookup on it, but `account_id` still reaches
 * `validateAuthContext` as an override — it is never trusted as primary input.
 *
 * @param request - Incoming request carrying the generation parameters.
 * @returns The validated body plus the resolved account, or a NextResponse the
 *   caller returns as-is (400, 401, or 403).
 */
export async function validateCreateMusicBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateMusicBody> {
  const body = await safeParseJson(request);
  const result = createMusicBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    // An unrecognized key is reported with an empty `path` and the offending
    // names under `keys`, so the default message would not tell the caller
    // which field to remove.
    const unknownKeys =
      firstError.code === "unrecognized_keys" ? (firstError as { keys: string[] }).keys : [];
    const error = unknownKeys.length
      ? `Unrecognized field(s): ${unknownKeys.join(", ")}`
      : firstError.message;

    return NextResponse.json(
      {
        status: "error",
        missing_fields: unknownKeys.length ? unknownKeys : firstError.path,
        error,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request, {
    accountId: result.data.account_id,
  });
  if (authResult instanceof NextResponse) return authResult;

  // Organizations are accounts, so an org-scoped generation is one whose
  // account_id is the organization. The caller expresses that through the
  // standard account_id override rather than a second parameter.
  return { accountId: authResult.accountId, ...result.data };
}
