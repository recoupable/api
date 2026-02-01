import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
import { validateAuthorizeConnectorBody } from "./validateAuthorizeConnectorBody";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

/**
 * Validated params for authorizing a connector.
 */
export interface AuthorizeConnectorParams {
  composioEntityId: string;
  connector: string;
  callbackUrl?: string;
  entityType: "user" | "artist";
  authConfigs?: Record<string, string>;
}

/**
 * Validates the full POST /api/connectors/authorize request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Body validation (connector, entity_type, entity_id, allowed connector check)
 * 3. Access verification (for artist entities)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateAuthorizeConnectorRequest(
  request: NextRequest,
): Promise<NextResponse | AuthorizeConnectorParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication
  const authResult = await validateAccountIdHeaders(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate body (includes allowed connector check for artists)
  const body = await request.json();
  const validated = validateAuthorizeConnectorBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { connector, callback_url, entity_type, entity_id } = validated;

  // 3. Verify access and build params
  if (entity_type === "artist") {
    const hasAccess = await checkAccountArtistAccess(accountId, entity_id!);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this artist" },
        { status: 403, headers },
      );
    }

    // Build auth configs for custom OAuth
    const authConfigs: Record<string, string> = {};
    if (connector === "tiktok" && process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
      authConfigs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
    }

    return {
      composioEntityId: entity_id!,
      connector,
      callbackUrl: callback_url,
      entityType: entity_type,
      authConfigs: Object.keys(authConfigs).length > 0 ? authConfigs : undefined,
    };
  }

  return {
    composioEntityId: accountId,
    connector,
    callbackUrl: callback_url,
    entityType: entity_type,
  };
}
