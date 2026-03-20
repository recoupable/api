import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetOrganizationsRequest } from "@/lib/organizations/validateGetOrganizationsRequest";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { formatAccountOrganizations } from "@/lib/organizations/formatAccountOrganizations";

/**
 * Handler for retrieving organizations for an account.
 *
 * Authenticates via x-api-key or Authorization bearer token.
 * Returns the key owner's organizations.
 * For Recoup admin: returns all organizations.
 *
 * Optional query parameter:
 * - account_id: Filter to a specific account (requires shared org membership or admin access)
 *
 * @param request - The request object
 * @returns A NextResponse with organizations data
 */
export async function getOrganizationsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetOrganizationsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const rawOrgs = await getAccountOrganizations(validated);
    const organizations = formatAccountOrganizations(rawOrgs);

    return NextResponse.json(
      {
        status: "success",
        organizations,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getOrganizationsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
