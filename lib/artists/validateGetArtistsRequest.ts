import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { GetArtistsOptions } from "@/lib/artists/getArtists";
import { buildGetArtistsParams } from "./buildGetArtistsParams";
import { z } from "zod";

const getArtistsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  org_id: z.string().uuid("org_id must be a valid UUID").optional(),
  personal: z
    .enum(["true", "false"], { message: "personal must be 'true' or 'false'" })
    .transform(val => val === "true")
    .optional(),
});

/**
 * Validates GET /api/artists request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys/Bearer tokens: Returns the authenticated account's artists
 * For org keys: Returns the key owner's artists (can filter by account_id)
 * For Recoup admin key: Returns the key owner's artists (can filter by account_id)
 *
 * Query parameters:
 * - account_id: Filter to a specific account (org keys only)
 * - org_id: Filter to artists in a specific organization
 * - personal: Set to "true" to show only personal (non-org) artists
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or GetArtistsOptions
 */
export async function validateGetArtistsRequest(
  request: NextRequest,
): Promise<NextResponse | GetArtistsOptions> {
  // Parse query parameters first
  const { searchParams } = new URL(request.url);
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
    org_id: searchParams.get("org_id") ?? undefined,
    personal: searchParams.get("personal") ?? undefined,
  };

  const queryResult = getArtistsQuerySchema.safeParse(queryParams);
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { account_id: targetAccountId, org_id: orgIdFilter, personal } = queryResult.data;

  // Use validateAuthContext for authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  // Use shared function to build params
  const { params, error } = await buildGetArtistsParams({
    accountId,
    orgId,
    targetAccountId,
    orgIdFilter,
    personal,
  });

  if (error) {
    return NextResponse.json(
      {
        status: "error",
        error,
      },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return params;
}
