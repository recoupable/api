import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";

/**
 * Handler for `GET /api/accounts/id`.
 *
 * Resolves the authenticated account ID from headers. Supports:
 * - `x-api-key` — looks up the existing account tied to that key
 * - `Authorization: Bearer <token>` — verifies a Privy access token
 *   and idempotently provisions an account if one does not yet exist
 *   for the user's email
 *
 * Exactly one of these headers must be provided.
 *
 * @param request - The request object
 * @returns A NextResponse with the accountId or error
 */
export async function getAccountIdHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateAccountIdHeaders(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    return NextResponse.json(
      { status: "success", accountId: validated.accountId },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAccountIdHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
