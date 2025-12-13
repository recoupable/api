import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";

/**
 * Handler for retrieving API keys for an account.
 * Requires authentication via Bearer token in Authorization header.
 *
 * @param request - The request object.
 * @returns A NextResponse with the API keys.
 */
export async function getApiKeysHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    const accountId = accountIdOrError;

    const { data, error } = await getApiKeys(accountId);

    if (error) {
      console.error("Error fetching API keys:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to fetch API keys",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        keys: data || [],
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error fetching API keys:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch API keys";
    return NextResponse.json(
      {
        status: "error",
        message,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
