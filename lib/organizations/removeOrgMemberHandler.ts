import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateRemoveOrgMemberQuery } from "@/lib/organizations/validateRemoveOrgMemberQuery";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";
import { deleteAccountOrganization } from "@/lib/supabase/account_organization_ids/deleteAccountOrganization";

/**
 * Handler for removing a member from an organization.
 * This operation is idempotent - removing an account that is not a member
 * succeeds without error.
 *
 * Query parameters:
 * - organization_id (required): The organization's account ID
 * - account_id (required): The member's account ID
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The request object containing the query parameters
 * @returns A NextResponse with the operation status
 */
export async function removeOrgMemberHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const validatedQuery = validateRemoveOrgMemberQuery(request);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const hasAccess = await canManageOrgMembers({
      accountId: authResult.accountId,
      organizationId: validatedQuery.organization_id,
    });

    if (!hasAccess) {
      return NextResponse.json(
        {
          status: "error",
          message: "Caller is not a member of the organization",
        },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    const deleted = await deleteAccountOrganization(
      validatedQuery.account_id,
      validatedQuery.organization_id,
    );

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
        message: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
