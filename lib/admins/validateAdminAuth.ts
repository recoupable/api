import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "./checkIsAdmin";

/**
 * Validates that the request is from an authenticated admin account.
 * Combines validateAuthContext + checkIsAdmin into a single call.
 *
 * @param request - The request object
 * @returns The auth context if the account is an admin, or a NextResponse error (401/403)
 */
export async function validateAdminAuth(
  request: NextRequest,
): Promise<NextResponse | { accountId: string; orgId: string | null; authToken: string }> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const isAdmin = await checkIsAdmin(auth.accountId);
  if (!isAdmin) {
    return NextResponse.json(
      { status: "error", message: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return auth;
}
