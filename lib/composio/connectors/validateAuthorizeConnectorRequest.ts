import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAuthorizeConnectorBody } from "./validateAuthorizeConnectorBody";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";

/**
 * Validated params for authorizing a connector.
 */
export interface AuthorizeConnectorParams {
  accountId: string;
  connector: string;
  callbackUrl?: string;
  authConfigs?: Record<string, string>;
}

/**
 * Validates the full POST /api/connectors/authorize request.
 *
 * Unopinionated: allows any connector for any account type.
 * Connector usage decisions (e.g., which tools the AI agent uses) are handled
 * at the tool router level, not the API level.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connector, callback_url, account_id)
 * 3. Access verification (when account_id is provided)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateAuthorizeConnectorRequest(
  request: NextRequest,
): Promise<NextResponse | AuthorizeConnectorParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication (supports x-api-key and Bearer token)
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate body structure
  const body = await request.json();
  const validated = validateAuthorizeConnectorBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { connector, callback_url, account_id } = validated;

  // 3. If account_id is provided, verify access and use that entity
  if (account_id) {
    const accessResult = await checkAccountAccess(accountId, account_id);
    if (!accessResult.hasAccess) {
      return NextResponse.json({ error: "Access denied to this account" }, { status: 403, headers });
    }

    // Build auth configs for custom OAuth
    const authConfigs: Record<string, string> = {};
    if (connector === "tiktok" && process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
      authConfigs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    }

    return {
      accountId: account_id,
      connector,
      callbackUrl: callback_url,
      authConfigs: Object.keys(authConfigs).length > 0 ? authConfigs : undefined,
    };
  }

  // No account_id: use the authenticated account
  return {
    accountId,
    connector,
    callbackUrl: callback_url,
  };
}
