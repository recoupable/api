import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorsHandler } from "@/lib/composio/connectors/getConnectorsHandler";
import { authorizeConnectorHandler } from "@/lib/composio/connectors/authorizeConnectorHandler";
import { disconnectConnectorHandler } from "@/lib/composio/connectors/disconnectConnectorHandler";

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
 * List all available connectors and their connection status.
 *
 * Query params:
 *   - account_id (optional): Entity ID for entity-specific connections (e.g., artist ID)
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * @param request
 * @returns List of connectors with connection status
 */
export async function GET(request: NextRequest) {
  return getConnectorsHandler(request);
}

/**
 * POST /api/connectors
 *
 * Generate an OAuth authorization URL for a specific connector.
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * Request body:
 * - connector: The connector slug, e.g., "googlesheets" or "tiktok" (required)
 * - callback_url: Optional custom callback URL after OAuth
 * - account_id: Optional account ID for account-specific connections
 *
 * @param request
 * @returns The redirect URL for OAuth authorization
 */
export async function POST(request: NextRequest) {
  return authorizeConnectorHandler(request);
}

/**
 * DELETE /api/connectors
 *
 * Disconnect a connected account from Composio.
 *
 * Body:
 * - connected_account_id (required): The connected account ID to disconnect
 * - account_id (optional): Entity ID for ownership verification (e.g., artist ID)
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * @param request
 */
export async function DELETE(request: NextRequest) {
  return disconnectConnectorHandler(request);
}
