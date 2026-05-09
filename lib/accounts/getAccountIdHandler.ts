import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";

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
    const apiKey = request.headers.get("x-api-key");
    const authHeader = request.headers.get("authorization");

    const hasApiKey = !!apiKey;
    const hasAuth = !!authHeader;

    if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Exactly one of x-api-key or Authorization must be provided",
        },
        { status: 401, headers: getCorsHeaders() },
      );
    }

    let accountId: string;

    if (hasApiKey) {
      const result = await getApiKeyAccountId(request);
      if (result instanceof NextResponse) {
        return result;
      }
      accountId = result;
    } else {
      const authToken = getBearerToken(authHeader);
      if (!authToken) {
        return NextResponse.json(
          {
            status: "error",
            message: "Authorization header with Bearer token required",
          },
          { status: 401, headers: getCorsHeaders() },
        );
      }
      try {
        accountId = await getOrCreateAccountIdByAuthToken(authToken);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to verify authentication token";
        return NextResponse.json(
          { status: "error", message },
          { status: 401, headers: getCorsHeaders() },
        );
      }
    }

    return NextResponse.json(
      { status: "success", accountId },
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
