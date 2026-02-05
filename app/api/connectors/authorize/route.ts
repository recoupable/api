import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authorizeConnectorHandler } from "@/lib/composio/connectors/authorizeConnectorHandler";

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
 * Authentication: x-api-key OR Authorization Bearer token required.
 *
 * Request body:
 * - connector: The connector slug, e.g., "googlesheets" or "tiktok" (required)
 * - callback_url: Optional custom callback URL after OAuth
 * - account_id: Optional entity ID (e.g., artist ID) for entity-specific connections
 *
 * @param request
 * @returns The redirect URL for OAuth authorization
 */
export async function POST(request: NextRequest) {
  return authorizeConnectorHandler(request);
}
