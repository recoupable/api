import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateOrganizationBody } from "@/lib/organizations/validateCreateOrganizationBody";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { addAccountToOrganization } from "@/lib/supabase/account_organization_ids/addAccountToOrganization";

/**
 * Handler for creating a new organization.
 * Creates the org account, account_info, and links the creator as a member.
 *
 * Body parameters:
 * - name (required): The name of the organization
 * - accountId (required): The account ID of the creator
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the created organization
 */
export async function createOrganizationHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validatedBody = validateCreateOrganizationBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    // Create the organization account
    const org = await insertAccount({ name: validatedBody.name });

    // Create account_info for the org
    await insertAccountInfo({ account_id: org.id });

    // Add the creator as a member of the org
    await addAccountToOrganization(validatedBody.accountId, org.id);

    return NextResponse.json(
      {
        status: "success",
        organization: {
          id: org.id,
          name: org.name,
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] createOrganizationHandler:", error);
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
