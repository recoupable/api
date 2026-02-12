import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateDisconnectConnectorBody } from "./validateDisconnectConnectorBody";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";
import { verifyConnectorOwnership } from "./verifyConnectorOwnership";

/**
 * Validated params for disconnecting a connector.
 */
export interface DisconnectConnectorParams {
  connectedAccountId: string;
  targetAccountId?: string;
}

/**
 * Validates the full DELETE /api/connectors request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connected_account_id, account_id)
 * 3. Access verification (account access or connector ownership)
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
    // Disconnecting for another account - verify access to that account
    const accessResult = await checkAccountAccess(accountId, account_id);
    if (!accessResult.hasAccess) {
      return NextResponse.json({ error: "Access denied to this account" }, { status: 403, headers });
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
    targetAccountId: account_id,
  };
}
