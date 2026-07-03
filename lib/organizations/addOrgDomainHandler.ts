import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAddOrgDomainRequest } from "@/lib/organizations/validateAddOrgDomainRequest";
import { selectOrganizationDomain } from "@/lib/supabase/organization_domains/selectOrganizationDomain";
import { insertOrganizationDomain } from "@/lib/supabase/organization_domains/insertOrganizationDomain";

/**
 * Handler for mapping an email domain to an organization.
 * A domain can belong to at most one organization; re-adding the same
 * domain to the same organization is idempotent, while a domain already
 * mapped to a different organization returns 409.
 *
 * Auth, body validation (including domain normalization), and access
 * checks live in validateAddOrgDomainRequest. This handler performs the
 * idempotent insert and shapes the response.
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the domain mapping
 */
export async function addOrgDomainHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateAddOrgDomainRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { body } = validated;

    const existing = await selectOrganizationDomain(body.domain);

    if (existing && existing.organization_id !== body.organizationId) {
      return NextResponse.json(
        {
          status: "error",
          message: `Domain "${body.domain}" is already mapped to a different organization`,
        },
        { status: 409, headers: getCorsHeaders() },
      );
    }

    const row = existing ?? (await insertOrganizationDomain(body));

    if (!row) {
      return NextResponse.json(
        { status: "error", message: "Failed to map domain to organization" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        id: row.id,
        domain: row.domain,
        organization_id: row.organization_id,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] addOrgDomainHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
