import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

/**
 * Resolves an email address to an account ID.
 *
 * @param email - The email address to look up
 * @returns The account ID string, or a NextResponse error (404)
 */
export async function resolveAccountIdFromEmail(
  email: string,
): Promise<string | NextResponse> {
  const emailAccount = await selectAccountByEmail(email);

  if (!emailAccount?.account_id) {
    return NextResponse.json(
      { status: "error", error: "No account found for the provided email" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return emailAccount.account_id;
}
