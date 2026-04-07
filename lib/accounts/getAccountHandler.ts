import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { validateGetAccountParams } from "@/lib/accounts/validateGetAccountParams";

/**
 * Handler for retrieving account details by ID or email.
 *
 * Accepts either a UUID account ID or an email address as the path parameter.
 * Requires exactly one of `x-api-key` or `Authorization: Bearer`.
 * The caller must be allowed to access the account (self, shared org, or Recoup admin).
 *
 * @param request - The request object
 * @param params - Route params containing the account ID or email
 * @returns A NextResponse with account data or error
 */
export async function getAccountHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const resolved = await validateGetAccountParams(request, id);
    if (resolved instanceof NextResponse) {
      return resolved;
    }
    const accountId = resolved;

    const account = await getAccountWithDetails(accountId);

    if (!account) {
      return NextResponse.json(
        {
          status: "error",
          error: "Account not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        account,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getAccountHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
