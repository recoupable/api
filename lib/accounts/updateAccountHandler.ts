import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { updateAccount } from "@/lib/supabase/accounts/updateAccount";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import type { UpdateAccountBody } from "./validateUpdateAccountBody";

/**
 * Handles PATCH /api/accounts - Update account profile information.
 *
 * @param body - Validated request body with accountId and fields to update
 * @returns NextResponse with updated account data
 */
export async function updateAccountHandler(body: UpdateAccountBody): Promise<NextResponse> {
  const {
    accountId,
    name,
    instruction,
    organization,
    image,
    jobTitle,
    roleType,
    companyName,
    knowledges,
  } = body;

  try {
    // Verify account exists
    const found = await getAccountWithDetails(accountId);
    if (!found) {
      return NextResponse.json(
        { data: null, message: "Account not found" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    // Update account name if provided
    if (name !== undefined) {
      await updateAccount(accountId, { name });
    }

    // Check if account_info exists
    const existingInfo = await selectAccountInfo(accountId);

    if (!existingInfo) {
      // Create new account_info record
      await insertAccountInfo({
        account_id: accountId,
        organization,
        image,
        instruction,
        job_title: jobTitle,
        role_type: roleType,
        company_name: companyName,
        knowledges,
      });
    } else {
      // Update existing account_info
      await updateAccountInfo(accountId, {
        organization,
        image,
        instruction,
        job_title: jobTitle,
        role_type: roleType,
        company_name: companyName,
        knowledges,
      });
    }

    // Fetch the updated account with all joined info
    const updated = await getAccountWithDetails(accountId);

    return NextResponse.json({ data: updated }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
