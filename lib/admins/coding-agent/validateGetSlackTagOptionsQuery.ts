import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import type { NextRequest } from "next/server";

/**
 * Validates admin auth for GET /api/admins/coding-agent/slack-tags.
 * No query params — always returns all-time unique tags.
 *
 * @param request - The incoming Next.js request
 * @returns A NextResponse on error, or true on success
 */
export async function validateGetSlackTagOptionsQuery(
  request: NextRequest,
): Promise<NextResponse | true> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  return true;
}
