import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountIdFromEmail } from "@/lib/accounts/resolveAccountIdFromEmail";

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

  const resolved = await resolveAccountIdFromEmail(email);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  // Verify caller can access the resolved account
  const accessResult = await validateAuthContext(request, {
    accountId: resolved,
  });
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  return resolved;
}
