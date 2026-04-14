import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorsHandler } from "@/lib/composio/connectors/getConnectorsHandler";
import { authorizeConnectorHandler } from "@/lib/composio/connectors/authorizeConnectorHandler";
import { disconnectConnectorHandler } from "@/lib/composio/connectors/disconnectConnectorHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
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
 * Lists every available Composio connector with its connection status for the caller.
 * When `account_id` is supplied, the statuses are scoped to that account (e.g. an
 * artist) instead of the authenticated caller. Requires `x-api-key` or
 * `Authorization: Bearer`.
 *
 * @param request - The incoming request. Optional query parameter: `account_id` — an
 *   account UUID (e.g. artist) to scope the connection status lookup to.
 * @returns A 200 NextResponse with `{ connectors: Array<{ slug, connected, ... }> }`,
 *   401 when unauthenticated, or 403 when the caller cannot access `account_id`.
 */
export async function GET(request: NextRequest) {
  return getConnectorsHandler(request);
}

/**
 * POST /api/connectors
 *
 * Generates a Composio OAuth authorization URL for a single connector. The caller
 * completes OAuth in the browser and is redirected to `callback_url` (or a default).
 * Requires `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request. JSON body: `connector` (required slug, e.g.
 *   `"googlesheets"` or `"tiktok"`); `callback_url` (optional post-OAuth redirect);
 *   `account_id` (optional — the account to associate the connection with).
 * @returns A 200 NextResponse with `{ redirectUrl }` pointing the caller at the
 *   provider's OAuth consent page, 400 on a missing/invalid `connector`, 401 when
 *   unauthenticated, or 403 when the caller cannot access `account_id`.
 */
export async function POST(request: NextRequest) {
  return authorizeConnectorHandler(request);
}

/**
 * DELETE /api/connectors
 *
 * Disconnects a previously-connected Composio account so it can no longer be used for
 * tool calls. Requires `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request. JSON body: `connected_account_id` (required
 *   — the Composio connected-account id to remove); `account_id` (optional — used to
 *   verify ownership of the connected account).
 * @returns A 200 NextResponse on successful disconnect, 400 on a missing
 *   `connected_account_id`, 401 when unauthenticated, 403 when the caller does not
 *   own the connection, or 404 when the connected account does not exist.
 */
export async function DELETE(request: NextRequest) {
  return disconnectConnectorHandler(request);
}
