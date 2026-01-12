import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { disconnectConnector } from "@/lib/composio/connectors/disconnectConnector";

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
 * POST /api/connectors/disconnect
 *
 * Disconnect a connected account from Composio.
 *
 * Body: { connected_account_id: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const body = await request.json();
    const { connected_account_id } = body;

    if (!connected_account_id) {
      return NextResponse.json(
        { error: "connected_account_id is required" },
        { status: 400, headers },
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
