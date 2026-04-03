import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";

/**
 * Handler for retrieving account details by ID.
 *
 * Requires exactly one of `x-api-key` or `Authorization: Bearer`.
 * The caller must be allowed to access the account in the path (self, shared org, or Recoup admin).
 *
 * @param request - The request object
 * @param params - Route params containing the account ID
 * @returns A NextResponse with account data or error
 */
export async function getAccountHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

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

    const account = await getAccountWithDetails(validatedParams.id);

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
