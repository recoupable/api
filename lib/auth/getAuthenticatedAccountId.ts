import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getAccountIdByAuthToken } from "@/lib/privy/getAccountIdByAuthToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Extracts and validates the authentication token from the request,
 * then returns the authenticated account ID.
 *
 * @param request - The NextRequest object
 * @returns Either the account ID string, or a NextResponse error if authentication fails
 */
export async function getAuthenticatedAccountId(
  request: NextRequest,
): Promise<string | NextResponse> {
  const authHeader = request.headers.get("authorization");
  const authToken = getBearerToken(authHeader);

  if (!authToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Authorization header with Bearer token required",
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }

  try {
    const accountId = await getAccountIdByAuthToken(authToken);
    return accountId;
  } catch (error) {
    console.error("[ERROR] Authentication failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to verify authentication token";
    return NextResponse.json(
      {
        status: "error",
        message,
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }
}
