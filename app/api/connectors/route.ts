import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectors } from "@/lib/composio/connectors";

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
 * Query params:
 * - account_id: The user's account ID (required)
 *
 * @returns List of connectors with connection status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    const accountId = request.nextUrl.searchParams.get("account_id");

    if (!accountId) {
      return NextResponse.json(
        { error: "account_id query parameter is required" },
        { status: 400, headers },
      );
    }

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
