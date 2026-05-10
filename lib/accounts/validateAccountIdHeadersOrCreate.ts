import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getBearerToken } from "@/lib/auth/getBearerToken";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import type { AccountIdHeaders } from "./validateAccountIdHeaders";

/**
 * Like `validateAccountIdHeaders`, but routes the Bearer path through
 * `getOrCreateAccountIdByAuthToken` so a brand-new Privy user with no
 * recoupable account row is provisioned on the spot instead of 401-ing.
 *
 * Reserved for `GET /api/accounts/id` — the natural "establish identity"
 * endpoint. Other Bearer-authenticated routes should keep using the
 * strict `validateAccountIdHeaders` so a deleted/missing account stays
 * an error rather than silently re-creating itself.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated accountId.
 */
export async function validateAccountIdHeadersOrCreate(
  request: NextRequest,
): Promise<NextResponse | AccountIdHeaders> {
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

  if (hasApiKey) {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    return { accountId: accountIdOrError };
  }

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
    const accountId = await getOrCreateAccountIdByAuthToken(authToken);
    return { accountId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify authentication token";
    return NextResponse.json(
      { status: "error", message },
      { status: 401, headers: getCorsHeaders() },
    );
  }
}
