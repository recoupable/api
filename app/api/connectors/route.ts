import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectors } from "@/lib/composio/connectors";
import { disconnectConnector } from "@/lib/composio/connectors/disconnectConnector";
import { validateDisconnectConnectorBody } from "@/lib/composio/connectors/validateDisconnectConnectorBody";
import { verifyConnectorOwnership } from "@/lib/composio/connectors/verifyConnectorOwnership";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";

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
 * GET /api/connectors
 *
 * List all available connectors and their connection status for a user.
 *
 * Authentication: x-api-key header required.
 *
 * @returns List of connectors with connection status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    const accountId = accountIdOrError;

    const connectors = await getConnectors(accountId);

    return NextResponse.json(
      {
        success: true,
        data: {
          connectors,
        },
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch connectors";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}

/**
 * DELETE /api/connectors
 *
 * Disconnect a connected account from Composio.
 *
 * Authentication: x-api-key header required.
 *
 * Body: { connected_account_id: string }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    const accountId = accountIdOrError;
    const body = await request.json();

    const validated = validateDisconnectConnectorBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { connected_account_id } = validated;

    // Verify the connected account belongs to the authenticated user
    const isOwner = await verifyConnectorOwnership(accountId, connected_account_id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Connected account not found or does not belong to this user" },
        { status: 403, headers }
      );
    }

    const result = await disconnectConnector(connected_account_id);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200, headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to disconnect connector";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
