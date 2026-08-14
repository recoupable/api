import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

export const runValuationBodySchema = z.object({
  spotify_artist_id: z.string().min(1, "spotify_artist_id must not be empty"),
  organization_id: z.string().uuid("organization_id must be a valid UUID").optional(),
});

export type ValidatedRunValuationRequest = {
  accountId: string;
  spotify_artist_id: string;
  organizationId?: string;
};

/**
 * Validates `POST /api/valuation` — auth + body in one place (SRP). Resolves
 * the calling account from the request credentials (Privy bearer or x-api-key)
 * and requires a `spotify_artist_id`. Mirrors validateCreateMeasurementJobRequest.
 *
 * `organization_id` optionally names an organization to own the resulting catalog
 * instead of the caller (chat#1938). Membership is authorized here, not trusted.
 *
 * Membership is checked with `validateOrganizationAccess` after the body is parsed,
 * rather than by passing `organizationId` into `validateAuthContext`, because that
 * would force the body to be read before authenticating — the 401 deliberately
 * precedes any body handling on this endpoint. `validateAuthContext` delegates to
 * the same function, so the authorization is identical.
 *
 * @param request - The incoming HTTP request.
 * @returns The validated `{ accountId, spotify_artist_id, organizationId }`, or a
 *   NextResponse (401 for auth, 400 for body, 403 for a non-member) to return directly.
 */
export async function validateRunValuationRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedRunValuationRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const raw = await request.json().catch(() => null);
  const result = runValuationBodySchema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const organizationId = result.data.organization_id;
  if (organizationId) {
    const hasOrgAccess = await validateOrganizationAccess({
      accountId: authResult.accountId,
      organizationId,
    });

    if (!hasOrgAccess) {
      return NextResponse.json(
        { status: "error", error: "Access denied to specified organization_id" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return {
    accountId: authResult.accountId,
    spotify_artist_id: result.data.spotify_artist_id,
    organizationId,
  };
}
