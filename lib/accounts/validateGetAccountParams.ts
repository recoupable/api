import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { resolveAccountIdByEmail } from "@/lib/accounts/resolveAccountIdByEmail";

/**
 * Resolves a path parameter (UUID or email) to an authorized account ID.
 *
 * - Email: delegates to resolveAccountIdByEmail (auth + lookup + access check)
 * - UUID: validates format, then checks auth + access
 *
 * @param request - The incoming request (for auth headers)
 * @param id - The path parameter (UUID or email)
 * @returns The authorized account ID, or a NextResponse error
 */
export async function validateGetAccountParams(
  request: NextRequest,
  id: string,
): Promise<string | NextResponse> {
  if (id.includes("@")) {
    return resolveAccountIdByEmail(request, id);
  }

  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const authResult = await validateAuthContext(request, {
    accountId: validatedParams.id,
  });
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return validatedParams.id;
}
