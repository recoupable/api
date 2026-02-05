import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAuthorizeConnectorBody } from "./validateAuthorizeConnectorBody";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

/**
 * Validated params for authorizing a connector.
 */
export interface AuthorizeConnectorParams {
  composioEntityId: string;
  connector: string;
  callbackUrl?: string;
  authConfigs?: Record<string, string>;
}

/**
 * Validates the full POST /api/connectors/authorize request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connector, account_id, allowed connector check)
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

  // 2. Validate body (includes allowed connector check when account_id is provided)
  const body = await request.json();
  const validated = validateAuthorizeConnectorBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { connector, callback_url, account_id } = validated;

  // 3. If account_id is provided, verify access and use that entity
  if (account_id) {
    const hasAccess = await checkAccountArtistAccess(accountId, account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this entity" }, { status: 403, headers });
    }

    // Build auth configs for custom OAuth
    const authConfigs: Record<string, string> = {};
    if (connector === "tiktok" && process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
      authConfigs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    }

    return {
      composioEntityId: account_id,
      connector,
      callbackUrl: callback_url,
      authConfigs: Object.keys(authConfigs).length > 0 ? authConfigs : undefined,
    };
  }

  // No account_id: use the authenticated account
  return {
    composioEntityId: accountId,
    connector,
    callbackUrl: callback_url,
  };
}
