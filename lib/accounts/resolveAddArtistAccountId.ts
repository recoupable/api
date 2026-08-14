import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { resolveAccountIdByEmail } from "@/lib/accounts/resolveAccountIdByEmail";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";

/**
 * Resolves the target account for POST /api/accounts/artists.
 *
 * Defaults to the authenticated account. When an email override is provided,
 * the email is resolved to an account and the caller must have access to it
 * (self, managed artist, owned workspace, or member organization).
 *
 * @param authenticatedAccountId - The account ID derived from the credential
 * @param email - Optional email override for the target account
 * @returns The target account ID, or a NextResponse error (404/403)
 */
export async function resolveAddArtistAccountId(
  authenticatedAccountId: string,
  email?: string,
): Promise<string | NextResponse> {
  if (!email) {
    return authenticatedAccountId;
  }

  const targetAccountId = await resolveAccountIdByEmail(email);
  if (targetAccountId instanceof NextResponse) {
    return targetAccountId;
  }

  if (targetAccountId === authenticatedAccountId) {
    return targetAccountId;
  }

  const { hasAccess } = await checkAccountAccess(authenticatedAccountId, targetAccountId);
  if (!hasAccess) {
    return NextResponse.json(
      { status: "error", error: "Access denied to the account for the provided email" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return targetAccountId;
}
