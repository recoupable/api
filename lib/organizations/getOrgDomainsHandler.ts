import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateGetOrgDomainsRequest } from "@/lib/organizations/validateGetOrgDomainsRequest";
import { selectOrganizationDomains } from "@/lib/supabase/organization_domains/selectOrganizationDomains";

/**
 * Handler for listing the email domains mapped to an organization.
 *
 * Auth, query validation, and access checks live in
 * validateGetOrgDomainsRequest. This handler fetches the domain mappings
 * and shapes the response.
 *
 * @param request - The request object
 * @returns A NextResponse with the organization's domain mappings
 */
export async function getOrgDomainsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetOrgDomainsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const domains = await selectOrganizationDomains(validated.query.organization_id);

    if (domains === null) {
      return errorResponse("Failed to fetch organization domains", 500);
    }

    return NextResponse.json(
      { status: "success", domains },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getOrgDomainsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
