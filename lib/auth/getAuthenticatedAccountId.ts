import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Extracts and validates the authentication token from the request,
 * then returns the authenticated account ID.
 *
 * The Bearer token may be either a Recoup API key (`recoup_sk_…`) or a Privy
 * access token — the server parses the format and routes accordingly, so a
 * caller only ever needs to set one credential. A `recoup_sk_` key is validated
 * against `account_api_keys`; anything else is treated as a Privy JWT, and a
 * recoupable account is provisioned on the fly when none yet exists for the
 * user's Privy email (idempotent fetch-or-create, mirroring `POST /api/accounts`).
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

  // A Recoup API key sent as a Bearer token: validate it as an API key instead
  // of attempting (and failing) Privy JWT verification.
  if (authToken.startsWith("recoup_sk_")) {
    const accountId = await getAccountIdByApiKey(authToken);
    if (!accountId) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() },
      );
    }
    return accountId;
  }

  try {
    const accountId = await getOrCreateAccountIdByAuthToken(authToken);
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
