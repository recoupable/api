import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

/**
 * Authenticates the caller, resolves an email to an account ID,
 * and verifies the caller has access to the resolved account.
 *
 * @param request - The incoming request (for auth headers)
 * @param email - The email address to resolve
 * @returns The resolved account ID, or a NextResponse error (401/403/404)
 */
export async function resolveAccountIdByEmail(
  request: NextRequest,
  email: string,
): Promise<string | NextResponse> {
  // Authenticate before email lookup to prevent account-email probing
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const emailAccount = await selectAccountByEmail(email);
  if (!emailAccount?.account_id) {
    return NextResponse.json(
      { status: "error", error: "No account found for the provided email" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  // Verify caller can access the resolved account
  const accessResult = await validateAuthContext(request, {
    accountId: emailAccount.account_id,
  });
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  return emailAccount.account_id;
}
