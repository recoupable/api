import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateRemoveOrgMemberRequest } from "@/lib/organizations/validateRemoveOrgMemberRequest";
import { deleteAccountOrganization } from "@/lib/supabase/account_organization_ids/deleteAccountOrganization";

/**
 * Handler for removing a member from an organization.
 * This operation is idempotent - removing an account that is not a member
 * succeeds without error.
 *
 * Auth, query validation, and access checks live in
 * validateRemoveOrgMemberRequest. This handler performs the idempotent
 * delete and shapes the response.
 *
 * @param request - The request object containing the query parameters
 * @returns A NextResponse with the operation status
 */
export async function removeOrgMemberHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateRemoveOrgMemberRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { query } = validated;

    const deleted = await deleteAccountOrganization(query.account_id, query.organization_id);

    if (!deleted) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to remove member from organization",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] removeOrgMemberHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
