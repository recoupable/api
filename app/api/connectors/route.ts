import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorsHandler } from "@/lib/composio/connectors/getConnectorsHandler";
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
 *   - entity_type (optional): "user" (default) or "artist"
 *   - entity_id (required when entity_type=artist): The artist ID
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * @returns List of connectors with connection status
 */
export async function GET(request: NextRequest) {
  return getConnectorsHandler(request);
}

/**
 * DELETE /api/connectors
 *
 * Disconnect a connected account from Composio.
 *
 * Body:
 *   - connected_account_id (required): The connected account ID to disconnect
 *   - entity_type (optional): "user" (default) or "artist"
 *   - entity_id (required when entity_type=artist): The artist ID
 *
 * Authentication: x-api-key OR Authorization Bearer token required.
 */
export async function DELETE(request: NextRequest) {
  return disconnectConnectorHandler(request);
}
