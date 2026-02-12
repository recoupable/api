import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { GetArtistsOptions } from "@/lib/artists/getArtists";
import { buildGetArtistsParams } from "./buildGetArtistsParams";
import { z } from "zod";

const getArtistsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  organization_id: z.string().uuid("organization_id must be a valid UUID").optional(),
});

/**
 * Validates GET /api/artists request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: Returns the key owner's personal artists
 * For org keys: Returns the key owner's personal artists (use organization_id for org artists)
 *
 * Query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 * - organization_id: Filter to artists in a specific organization
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
    organization_id: searchParams.get("organization_id") ?? undefined,
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

  const { account_id: targetAccountId, organization_id: organizationId } = queryResult.data;

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
    organizationId,
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
