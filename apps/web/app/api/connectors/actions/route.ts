import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorActionsHandler } from "@/lib/composio/connectors/getConnectorActionsHandler";
import { executeConnectorActionHandler } from "@/lib/composio/connectors/executeConnectorActionHandler";

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
 * GET /api/connectors/actions
 *
 * Lists every executable connector action (e.g. `GMAIL_FETCH_EMAILS`,
 * `GOOGLESHEETS_WRITE_SPREADSHEET`) the caller can run, plus per-action
 * connection status. Each action returns its slug (UPPERCASE_SNAKE_CASE),
 * description, parameters JSON Schema, parent connectorSlug, and isConnected.
 * Requires `x-api-key` or `Authorization: Bearer`.
 *
 * @param request - The incoming request. Optional query parameter: `account_id` —
 *   an account UUID (e.g. artist) to scope the catalog to.
 * @returns A 200 NextResponse with `{ success, actions: ConnectorAction[] }`,
 *   400 on invalid query params, 401 when unauthenticated, or 403 when the
 *   caller cannot access `account_id`.
 */
export async function GET(request: NextRequest) {
  return getConnectorActionsHandler(request);
}

/**
 * POST /api/connectors/actions
 *
 * Executes a single connector action with the given parameters. The action's
 * parent connector must be currently connected — call `POST /api/connectors`
 * to authorize the connector first if not. Requires `x-api-key` or
 * `Authorization: Bearer`.
 *
 * @param request - The incoming request. JSON body: `actionSlug` (required —
 *   UPPERCASE_SNAKE_CASE slug from `GET /api/connectors/actions`); `parameters`
 *   (required — object matching the action's parameters schema); `account_id`
 *   (optional — the account whose connection should be used).
 * @returns A 200 NextResponse with `{ success, result, executedAt }`, 400 on
 *   missing/invalid body, 401 when unauthenticated, 403 when the caller
 *   cannot access `account_id`, or 404 when `actionSlug` is unknown.
 */
export async function POST(request: NextRequest) {
  return executeConnectorActionHandler(request);
}
