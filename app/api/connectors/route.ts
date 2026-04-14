import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorsHandler } from "@/lib/composio/connectors/getConnectorsHandler";
import { authorizeConnectorHandler } from "@/lib/composio/connectors/authorizeConnectorHandler";
import { disconnectConnectorHandler } from "@/lib/composio/connectors/disconnectConnectorHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * Handles GET requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function GET(request: NextRequest) {
  return getConnectorsHandler(request);
}

/**
 * Handles POST requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function POST(request: NextRequest) {
  return authorizeConnectorHandler(request);
}

/**
 * Handles DELETE requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function DELETE(request: NextRequest) {
  return disconnectConnectorHandler(request);
}
