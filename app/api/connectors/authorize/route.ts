import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authorizeConnector } from "@/lib/composio/connectors";

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
 * Request body:
 * - account_id: The user's account ID (required)
 * - connector: The connector slug, e.g., "googlesheets" (required)
 * - callback_url: Optional custom callback URL after OAuth
 *
 * @returns The redirect URL for OAuth authorization
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const body = await request.json();
    const { account_id, connector, callback_url } = body;

    if (!account_id) {
      return NextResponse.json(
        { error: "account_id is required" },
        { status: 400, headers },
      );
    }

    if (!connector) {
      return NextResponse.json(
        { error: "connector is required (e.g., 'googlesheets', 'gmail')" },
        { status: 400, headers },
      );
    }

    const result = await authorizeConnector(account_id, connector, callback_url);

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
