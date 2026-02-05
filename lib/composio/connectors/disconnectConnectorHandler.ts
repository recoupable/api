import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDisconnectConnectorRequest } from "./validateDisconnectConnectorRequest";
import { disconnectConnector } from "./disconnectConnector";

/**
 * Handler for DELETE /api/connectors.
 *
 * Disconnects a connected account from Composio.
 * Supports disconnecting for the authenticated account or another entity (via account_id).
 *
 * @param request - The incoming request
 * @returns Success status
 */
export async function disconnectConnectorHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();

  try {
    // Validate auth, body, and access in one call
    const validated = await validateDisconnectConnectorRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { connectedAccountId, entityId } = validated;

    // Disconnect from Composio
    if (entityId) {
      // Disconnecting for another entity - verify ownership
      await disconnectConnector(connectedAccountId, {
        verifyOwnershipFor: entityId,
      });
    } else {
      // User's own connection - already verified in validation
      await disconnectConnector(connectedAccountId);
    }

    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect connector";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
