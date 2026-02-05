import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateDisconnectConnectorBody } from "./validateDisconnectConnectorBody";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { verifyConnectorOwnership } from "./verifyConnectorOwnership";

/**
 * Validated params for disconnecting a connector.
 */
export interface DisconnectConnectorParams {
  connectedAccountId: string;
  entityId?: string;
}

/**
 * Validates the full DELETE /api/connectors request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connected_account_id, account_id)
 * 3. Access verification (entity access or connector ownership)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateDisconnectConnectorRequest(
  request: NextRequest,
): Promise<NextResponse | DisconnectConnectorParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication (supports x-api-key and Bearer token)
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate body
  const body = await request.json();
  const validated = validateDisconnectConnectorBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { connected_account_id, account_id } = validated;

  // 3. Verify access
  if (account_id) {
    // Disconnecting for another entity - verify access to that entity
    const hasAccess = await checkAccountArtistAccess(accountId, account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this entity" }, { status: 403, headers });
    }
  } else {
    // Disconnecting account's own connection - verify ownership
    const isOwner = await verifyConnectorOwnership(accountId, connected_account_id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Connected account not found or access denied" },
        { status: 403, headers },
      );
    }
  }

  return {
    connectedAccountId: connected_account_id,
    entityId: account_id,
  };
}
