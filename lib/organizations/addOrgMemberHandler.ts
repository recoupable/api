import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAddOrgMemberRequest } from "@/lib/organizations/validateAddOrgMemberRequest";
import { getOrCreateAccountByEmail } from "@/lib/accounts/getOrCreateAccountByEmail";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { addAccountToOrganization } from "@/lib/supabase/account_organization_ids/addAccountToOrganization";

/**
 * Handler for adding a member to an organization.
 * This operation is idempotent - adding an existing member returns the
 * existing membership.
 *
 * Auth, body validation, and access checks live in
 * validateAddOrgMemberRequest. This handler resolves the member account,
 * performs the idempotent insert, and shapes the response.
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the membership record ID and member account ID
 */
export async function addOrgMemberHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateAddOrgMemberRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { body } = validated;

    const memberAccountId =
      body.accountId ?? (await getOrCreateAccountByEmail(body.email as string));

    if (!memberAccountId) {
      return errorResponse("Failed to resolve an account for the provided email", 500);
    }

    const existingMemberships = await getAccountOrganizations({
      accountId: memberAccountId,
      organizationId: body.organizationId,
    });

    const id =
      existingMemberships[0]?.id ??
      (await addAccountToOrganization(memberAccountId, body.organizationId));

    if (!id) {
      return errorResponse("Failed to add member to organization", 500);
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
    return errorResponse("Internal server error", 500);
  }
}
