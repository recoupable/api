import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";

export type AccountIdHeaders = {
  accountId: string;
};

/**
 * Validates auth headers and resolves the associated account ID.
 *
 * Exactly one of:
 * - x-api-key
 * - Authorization: Bearer <token>
 * must be provided.
 *
 * Pass `createIfMissing: true` to provision a recoupable account on the
 * fly when the Bearer token resolves to an email that has no row yet —
 * appropriate for the "establish identity" endpoint (`GET /api/accounts/id`),
 * not for routes that should treat a missing account as an error.
 *
 * @param request - The NextRequest object
 * @param options - Resolution options. `createIfMissing` defaults to false.
 * @returns A NextResponse with an error if validation fails, or the validated accountId if validation passes.
 */
export async function validateAccountIdHeaders(
  request: NextRequest,
  { createIfMissing = false }: { createIfMissing?: boolean } = {},
): Promise<NextResponse | AccountIdHeaders> {
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");

  const hasApiKey = !!apiKey;
  const hasAuth = !!authHeader;

  // Enforce that exactly one auth mechanism is provided
  if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Exactly one of x-api-key or Authorization must be provided",
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }

  // Delegate to API key auth
  if (hasApiKey) {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    return { accountId: accountIdOrError };
  }

  // Delegate to bearer token auth
  const accountIdOrError = await getAuthenticatedAccountId(request, { createIfMissing });
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }

  return { accountId: accountIdOrError };
}
