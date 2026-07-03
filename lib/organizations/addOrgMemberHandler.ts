import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAddOrgMemberBody } from "@/lib/organizations/validateAddOrgMemberBody";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";
import { getOrCreateAccountByEmail } from "@/lib/accounts/getOrCreateAccountByEmail";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { addAccountToOrganization } from "@/lib/supabase/account_organization_ids/addAccountToOrganization";

/**
 * Handler for adding a member to an organization.
 * This operation is idempotent - adding an existing member returns the
 * existing membership.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID
 * - accountId or email (exactly one): The member to add. An email is
 *   resolved to an account, creating it if it does not exist yet.
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the membership record ID and member account ID
 */
export async function addOrgMemberHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json().catch(() => null);
    const validatedBody = validateAddOrgMemberBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const hasAccess = await canManageOrgMembers({
      accountId: authResult.accountId,
      organizationId: validatedBody.organizationId,
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

    const memberAccountId =
      validatedBody.accountId ?? (await getOrCreateAccountByEmail(validatedBody.email as string));

    if (!memberAccountId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to resolve an account for the provided email",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    const existingMemberships = await getAccountOrganizations({
      accountId: memberAccountId,
      organizationId: validatedBody.organizationId,
    });

    const id =
      existingMemberships[0]?.id ??
      (await addAccountToOrganization(memberAccountId, validatedBody.organizationId));

    if (!id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to add member to organization",
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
        id,
        account_id: memberAccountId,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] addOrgMemberHandler:", error);
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
