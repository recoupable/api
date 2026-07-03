import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateRemoveOrgDomainRequest } from "@/lib/organizations/validateRemoveOrgDomainRequest";
import { deleteOrganizationDomain } from "@/lib/supabase/organization_domains/deleteOrganizationDomain";

/**
 * Handler for removing an email domain mapping from an organization.
 * This operation is idempotent - removing a mapping that does not exist succeeds.
 *
 * Auth, query validation (including domain normalization), and access
 * checks live in validateRemoveOrgDomainRequest. This handler performs the
 * idempotent delete and shapes the response.
 *
 * @param request - The request object
 * @returns A NextResponse indicating success
 */
export async function removeOrgDomainHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateRemoveOrgDomainRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { query } = validated;

    const deleted = await deleteOrganizationDomain({
      domain: query.domain,
      organizationId: query.organization_id,
    });

    if (!deleted) {
      return errorResponse("Failed to remove domain mapping", 500);
    }

    return NextResponse.json({ status: "success" }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] removeOrgDomainHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
