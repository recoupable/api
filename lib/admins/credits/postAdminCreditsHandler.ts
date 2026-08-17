import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { grantCreditsWithAudit } from "@/lib/supabase/credit_grants/grantCreditsWithAudit";
import { validateGrantCreditsRequest } from "./validateGrantCreditsRequest";

/**
 * Handler for `POST /api/admins/credits`.
 *
 * Sets an account's credit balance to an absolute value and records who set it
 * and why. Admin-only. See the OpenAPI contract on docs.recoupable.
 *
 * The grant holds until it is spent: the monthly refill is a floor and cannot
 * reduce a balance, so there is nothing to expire and nothing to re-grant on a
 * schedule.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the recorded grant.
 */
export async function postAdminCreditsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGrantCreditsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { accountId, remainingCredits, reason, grantedBy } = validated;

    // Checked here rather than left to the foreign key so an unknown account is
    // a clean 404 instead of a 500 from a constraint violation.
    const accounts = await selectAccounts(accountId);
    if (!accounts.length) {
      return NextResponse.json(
        { status: "error", message: `No account found with id: ${accountId}` },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    const grant = await grantCreditsWithAudit({
      accountId,
      grantedBy,
      reason,
      remainingCredits,
    });

    return NextResponse.json(
      {
        status: "success",
        grant_id: grant.id,
        account_id: grant.account_id,
        remaining_credits: grant.remaining_credits,
        previous_credits: grant.previous_credits,
        reason: grant.reason,
        granted_by: grant.granted_by,
        granted_at: grant.created_at,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] postAdminCreditsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
