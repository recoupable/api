import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { normalizeOrgDomain } from "@/lib/organizations/normalizeOrgDomain";
import { z } from "zod";

const removeOrgDomainQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
  domain: z.string({ message: "domain is required" }),
});

export interface RemoveOrgDomainQuery {
  organization_id: string;
  /** The normalized bare email domain (lowercase, no "@") */
  domain: string;
}

export interface RemoveOrgDomainRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated query parameters */
  query: RemoveOrgDomainQuery;
}

/**
 * Validates DELETE /api/organizations/domains requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * query validation, and the caller's access to manage the organization.
 * Normalizes the domain (lowercase, trimmed, leading "@" stripped) and
 * rejects strings that are not a plausible bare domain.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID
 * - domain (required): The email domain to unmap (e.g. "seekermusic.com")
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated query.
 */
export async function validateRemoveOrgDomainRequest(
  request: NextRequest,
): Promise<NextResponse | RemoveOrgDomainRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const searchParams = request.nextUrl.searchParams;
  const result = removeOrgDomainQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
    domain: searchParams.get("domain") ?? undefined,
  });

  if (!result.success) {
    return errorResponse(result.error.issues[0].message, 400);
  }

  const domain = normalizeOrgDomain(result.data.domain);
  if (!domain) {
    return errorResponse('domain must be a bare email domain (e.g. "seekermusic.com")', 400);
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
    query: { organization_id: result.data.organization_id, domain },
  };
}
