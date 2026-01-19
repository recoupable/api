import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authorizeConnector } from "@/lib/composio/connectors";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateAuthorizeConnectorBody } from "@/lib/composio/connectors/validateAuthorizeConnectorBody";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/connectors/authorize
 *
 * Generate an OAuth authorization URL for a specific connector.
 *
 * Authentication: x-api-key header required.
 * The account ID is inferred from the API key.
 *
 * Request body:
 * - connector: The connector slug, e.g., "googlesheets" (required)
 * - callback_url: Optional custom callback URL after OAuth
 *
 * @returns The redirect URL for OAuth authorization
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    const accountId = accountIdOrError;
    const body = await request.json();

    const validated = validateAuthorizeConnectorBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { connector, callback_url } = validated;
    const result = await authorizeConnector(accountId, connector, callback_url);

    return NextResponse.json(
      {
        success: true,
        data: {
          connector: result.connector,
          redirectUrl: result.redirectUrl,
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to authorize connector";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
