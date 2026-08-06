import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { addArtistToOrgBodySchema } from "@/lib/organizations/validateAddArtistToOrgBody";
import type { AddArtistToOrgBody } from "@/lib/organizations/validateAddArtistToOrgBody";

export interface AddArtistToOrgRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated request body */
  body: AddArtistToOrgBody;
}

/**
 * Validates POST /api/organizations/artists requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * body validation, and the caller's access to manage the organization.
 *
 * Body parameters:
 * - artistId (required): The artist's account ID
 * - organizationId (required): The organization's account ID
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Authentication runs before body validation so an unauthenticated caller
 * learns nothing about the schema, matching validateAddOrgMemberRequest.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated body.
 */
export async function validateAddArtistToOrgRequest(
  request: NextRequest,
): Promise<NextResponse | AddArtistToOrgRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const rawBody = await request.json().catch(() => null);
  const result = addArtistToOrgBodySchema.safeParse(rawBody);
  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  const hasAccess = await canManageOrganization({
    accountId: authResult.accountId,
    organizationId: result.data.organizationId,
  });

  if (!hasAccess) {
    return errorResponse("Caller is not a member of the organization", 403);
  }

  return {
    callerAccountId: authResult.accountId,
    body: result.data,
  };
}
