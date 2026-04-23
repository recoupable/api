import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

/**
 * Scope, not access: the response is the list of all pro-tier artists — the
 * paying-customer set. There is no per-row id to bind an access check to, so
 * admin-scope is enforced at the request boundary. Reuses `validateAdminAuth`
 * (validateAuthContext + Recoup-org membership check) rather than forking.
 */
export async function validateGetArtistsProRequest(
  request: NextRequest,
): Promise<NextResponse | Record<string, never>> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  return {};
}
