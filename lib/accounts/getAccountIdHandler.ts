import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";

/**
 * Handler for retrieving the authenticated account ID from headers.
 *
 * Supports authentication via:
 * - x-api-key
 * - Authorization: Bearer <token>
 *
 * Delegates header parsing and validation to getHeaderAccountId.
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

    const { accountId } = validated;

    return NextResponse.json(
      {
        status: "success",
        accountId,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getAccountIdHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
