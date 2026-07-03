import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetOrgDomainsQuery } from "@/lib/organizations/validateGetOrgDomainsQuery";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { selectOrganizationDomains } from "@/lib/supabase/organization_domains/selectOrganizationDomains";

/**
 * Handler for listing the email domains mapped to an organization.
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID (UUID)
 *
 * @param request - The request object
 * @returns A NextResponse with the organization's domain mappings
 */
export async function getOrgDomainsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const query = validateGetOrgDomainsQuery(request);
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

    const domains = await selectOrganizationDomains(query.organization_id);

    if (domains === null) {
      return NextResponse.json(
        { status: "error", message: "Failed to fetch organization domains" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { status: "success", domains },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getOrgDomainsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
