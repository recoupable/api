import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

// Ranges mirror the fal minimax/music-3 form, except the duration floor: fal
// allows 1 second, we floor at 10 because a shorter request costs a full
// workflow run and cannot produce a usable song.
export const createMusicBodySchema = z.object({
  prompt: z.string().min(1),
  lyrics: z.string().min(1),
  duration: z.number().min(10).max(300).default(60),
  seed: z.number().int().optional(),
  num_inference_steps: z.number().int().min(1).max(100).default(30),
  guidance_scale: z.number().min(0).max(20).default(1.7),
  account_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
});

export type ValidatedCreateMusicBody = {
  accountId: string;
  organizationId: string | null;
} & z.infer<typeof createMusicBodySchema>;

/**
 * Validates auth and request body for POST /api/music.
 *
 * The body is parsed before auth so a malformed request fails as a 400 rather
 * than spending an API-key lookup on it, but `account_id` / `organization_id`
 * still reach `validateAuthContext` as overrides — they are never trusted as
 * primary input.
 *
 * @param request - Incoming request carrying the generation parameters.
 * @returns The validated body plus the resolved account and organization, or a
 *   NextResponse the caller returns as-is (400, 401, or 403).
 */
export async function validateCreateMusicBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateMusicBody> {
  const body = await safeParseJson(request);
  const result = createMusicBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request, {
    accountId: result.data.account_id,
    organizationId: result.data.organization_id,
  });
  if (authResult instanceof NextResponse) return authResult;

  return {
    accountId: authResult.accountId,
    // An API key scoped to an organization carries its own org context; the
    // body only has to say so when the caller is a bearer token switching
    // between personal and organization scope.
    organizationId: result.data.organization_id ?? authResult.orgId,
    ...result.data,
  };
}
