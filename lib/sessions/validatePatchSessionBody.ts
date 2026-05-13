import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

export const patchSessionBodySchema = z.object({
  title: z.string().optional(),
  status: z.enum(["running", "completed", "failed", "archived"]).optional(),
  linesAdded: z.number().int().min(0).optional(),
  linesRemoved: z.number().int().min(0).optional(),
});

export type PatchSessionBody = z.infer<typeof patchSessionBodySchema>;

export interface ValidatedPatchSessionRequest {
  body: PatchSessionBody;
  auth: AuthContext;
}

/**
 * Validates a `PATCH /api/sessions/{sessionId}` request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Parses the JSON body (treating malformed JSON as an empty body)
 *   3. Validates the body against the Zod schema
 *
 * Returns either a 4xx NextResponse describing the first failure, or
 * the validated `{ body, auth }` ready for the handler to consume.
 *
 * @param request - The incoming request.
 * @returns A NextResponse on validation failure, or the validated body + auth.
 */
export async function validatePatchSessionBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedPatchSessionRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rawBody = await safeParseJson(request);
  const result = patchSessionBodySchema.safeParse(rawBody);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        path: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return { body: result.data, auth };
}
