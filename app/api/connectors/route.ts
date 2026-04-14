import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectorsHandler } from "@/lib/composio/connectors/getConnectorsHandler";
import { authorizeConnectorHandler } from "@/lib/composio/connectors/authorizeConnectorHandler";
import { disconnectConnectorHandler } from "@/lib/composio/connectors/disconnectConnectorHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function GET(request: NextRequest) {
  return getConnectorsHandler(request);
}

/**
 * POST.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function POST(request: NextRequest) {
  return authorizeConnectorHandler(request);
}

/**
 * DELETE.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function DELETE(request: NextRequest) {
  return disconnectConnectorHandler(request);
}
