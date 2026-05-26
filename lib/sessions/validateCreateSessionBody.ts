import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

/**
 * Body schema for `POST /api/sessions`. All fields optional — an empty
 * body creates a personal session against the caller's own workspace
 * repo (`recoupable/<accountId>`); passing `organizationId` creates an
 * org session against `recoupable/<organizationId>` (and validates org
 * access via `validateAuthContext`).
 *
 * `cloneUrl` and `branch` were removed (the api derives the URL itself
 * via `ensurePersonalRepo`); `repoOwner`/`repoName`/`isNewBranch` were
 * never accepted — they used to appear in the OpenAPI docs but Zod
 * silently dropped them. Cleaned up in recoupable/docs#226.
 */
export const createSessionBodySchema = z.object({
  title: z.string().optional(),
  organizationId: z.string().uuid("organizationId must be a valid UUID").optional(),
  sandboxType: z.literal("vercel", { error: "Invalid sandbox type" }).optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

export interface ValidatedCreateSessionRequest {
  body: CreateSessionBody;
  auth: AuthContext;
}

/**
 * Validates a `POST /api/sessions` request end-to-end:
 *   1. Parses the JSON body (treating malformed JSON as an empty body)
 *   2. Validates the body against the Zod schema
 *   3. Authenticates the caller via Privy Bearer / x-api-key, forwarding
 *      any body `organizationId` so `validateAuthContext` checks org
 *      access and sets `auth.orgId`.
 *
 * Returns either a 4xx NextResponse describing the first failure, or
 * the validated `{ body, auth }` ready for the handler to consume.
 *
 * @param request - The incoming request.
 * @returns A NextResponse on validation failure, or the validated body + auth.
 */
export async function validateCreateSessionBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateSessionRequest> {
  const rawBody = await safeParseJson(request);
  const result = createSessionBodySchema.safeParse(rawBody);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const auth = await validateAuthContext(request, {
    organizationId: result.data.organizationId ?? null,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  return { body: result.data, auth };
}
