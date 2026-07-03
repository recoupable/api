import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAddOrgDomainBody } from "@/lib/organizations/validateAddOrgDomainBody";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { selectOrganizationDomain } from "@/lib/supabase/organization_domains/selectOrganizationDomain";
import { insertOrganizationDomain } from "@/lib/supabase/organization_domains/insertOrganizationDomain";

/**
 * Handler for mapping an email domain to an organization.
 * A domain can belong to at most one organization; re-adding the same
 * domain to the same organization is idempotent, while a domain already
 * mapped to a different organization returns 409.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID (UUID)
 * - domain (required): The email domain to map (normalized to a lowercase bare domain)
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the domain mapping
 */
export async function addOrgDomainHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await request.json().catch(() => null);
    const validated = validateAddOrgDomainBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const hasAccess = await canManageOrganization({
      accountId: auth.accountId,
      organizationId: validated.organizationId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", message: "Access denied to specified organization_id" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const existing = await selectOrganizationDomain(validated.domain);

    if (existing && existing.organization_id !== validated.organizationId) {
      return NextResponse.json(
        {
          status: "error",
          message: `Domain "${validated.domain}" is already mapped to a different organization`,
        },
        { status: 409, headers: getCorsHeaders() },
      );
    }

    const row = existing ?? (await insertOrganizationDomain(validated));

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
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
