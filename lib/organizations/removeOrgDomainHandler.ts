import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateRemoveOrgDomainQuery } from "@/lib/organizations/validateRemoveOrgDomainQuery";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { deleteOrganizationDomain } from "@/lib/supabase/organization_domains/deleteOrganizationDomain";

/**
 * Handler for removing an email domain mapping from an organization.
 * This operation is idempotent - removing a mapping that does not exist succeeds.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID (UUID)
 * - domain (required): The email domain to unmap (normalized to a lowercase bare domain)
 *
 * @param request - The request object
 * @returns A NextResponse indicating success
 */
export async function removeOrgDomainHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const query = validateRemoveOrgDomainQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const hasAccess = await canManageOrganization({
      accountId: auth.accountId,
      organizationId: query.organization_id,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", message: "Access denied to specified organization_id" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const deleted = await deleteOrganizationDomain({
      domain: query.domain,
      organizationId: query.organization_id,
    });

    if (!deleted) {
      return NextResponse.json(
        { status: "error", message: "Failed to remove domain mapping" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ status: "success" }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] removeOrgDomainHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
