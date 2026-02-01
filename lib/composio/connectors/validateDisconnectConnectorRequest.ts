import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
import { validateDisconnectConnectorBody } from "./validateDisconnectConnectorBody";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { verifyConnectorOwnership } from "./verifyConnectorOwnership";

/**
 * Validated params for disconnecting a connector.
 */
export interface DisconnectConnectorParams {
  accountId: string;
  connectedAccountId: string;
  entityType: "user" | "artist";
  entityId?: string;
}

/**
 * Validates the full DELETE /api/connectors request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connected_account_id, entity_type, entity_id)
 * 3. Access verification (artist access or connector ownership)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateDisconnectConnectorRequest(
  request: NextRequest,
): Promise<NextResponse | DisconnectConnectorParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication
  const authResult = await validateAccountIdHeaders(request);
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
  const { connected_account_id, entity_type, entity_id } = validated;

  // 3. Verify access
  if (entity_type === "artist") {
    const hasAccess = await checkAccountArtistAccess(accountId, entity_id!);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this artist" },
        { status: 403, headers },
      );
    }
  } else {
    const isOwner = await verifyConnectorOwnership(accountId, connected_account_id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Connected account not found or does not belong to this user" },
        { status: 403, headers },
      );
    }
  }

  return {
    accountId,
    connectedAccountId: connected_account_id,
    entityType: entity_type,
    entityId: entity_id,
  };
}
