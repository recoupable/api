import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateOrganizationsQuery } from "@/lib/organizations/validateOrganizationsQuery";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { formatAccountOrganizations } from "@/lib/organizations/formatAccountOrganizations";

/**
 * Handler for retrieving organizations for an account.
 *
 * Query parameters:
 * - accountId (required): The account ID to get organizations for
 *
 * @param request - The request object containing query parameters
 * @returns A NextResponse with organizations data
 */
export async function getOrganizationsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateOrganizationsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const rawOrgs = await getAccountOrganizations({
      accountId: validatedQuery.accountId,
    });
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
