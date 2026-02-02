import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";

export type SandboxBody = AuthContext;

/**
 * Validates auth for POST /api/sandboxes.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if auth fails, or the auth context.
 */
export async function validateSandboxBody(
  request: NextRequest,
): Promise<NextResponse | SandboxBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return authResult;
}
