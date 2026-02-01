import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthorizeConnectorRequest } from "./validateAuthorizeConnectorRequest";
import { authorizeConnector } from "./authorizeConnector";

/**
 * Handler for POST /api/connectors/authorize.
 *
 * Generates an OAuth authorization URL for a specific connector.
 * Supports both user and artist connectors via entity_type parameter.
 *
 * @param request - The incoming request
 * @returns The redirect URL for OAuth authorization
 */
export async function authorizeConnectorHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    // Validate auth, body, and access in one call
    const validated = await validateAuthorizeConnectorRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { composioEntityId, connector, callbackUrl, entityType, authConfigs } = validated;

    // Execute authorization
    const result = await authorizeConnector(composioEntityId, connector, {
      customCallbackUrl: callbackUrl,
      entityType,
      authConfigs,
    });

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
    console.error("Connector authorize error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to authorize connector";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
