import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { resolveAccountIdFromEmail } from "@/lib/accounts/resolveAccountIdFromEmail";

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

    let accountId: string;

    if (id.includes("@")) {
      // Authenticate before email lookup to prevent account-email probing
      const authResult = await validateAuthContext(request);
      if (authResult instanceof NextResponse) {
        return authResult;
      }

      const resolved = await resolveAccountIdFromEmail(id);
      if (resolved instanceof NextResponse) {
        return resolved;
      }
      accountId = resolved;

      // Verify caller can access this account
      const accessResult = await validateAuthContext(request, {
        accountId,
      });
      if (accessResult instanceof NextResponse) {
        return accessResult;
      }
    } else {
      const validatedParams = validateAccountParams(id);
      if (validatedParams instanceof NextResponse) {
        return validatedParams;
      }
      accountId = validatedParams.id;

      const authResult = await validateAuthContext(request, {
        accountId,
      });
      if (authResult instanceof NextResponse) {
        return authResult;
      }
    }

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
