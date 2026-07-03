import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { z } from "zod";

const getOrgDomainsQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
});

export type GetOrgDomainsQuery = z.infer<typeof getOrgDomainsQuerySchema>;

export interface GetOrgDomainsRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated query parameters */
  query: GetOrgDomainsQuery;
}

/**
 * Validates GET /api/organizations/domains requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * query validation, and the caller's access to manage the organization.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated query.
 */
export async function validateGetOrgDomainsRequest(
  request: NextRequest,
): Promise<NextResponse | GetOrgDomainsRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const searchParams = request.nextUrl.searchParams;
  const result = getOrgDomainsQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
  });

  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  const hasAccess = await canManageOrganization({
    accountId: authResult.accountId,
    organizationId: result.data.organization_id,
  });

  if (!hasAccess) {
    return errorResponse("Access denied to specified organization_id", 403);
  }

  return {
    callerAccountId: authResult.accountId,
    query: result.data,
  };
}
