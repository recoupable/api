import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetConnectorsQuery } from "./validateGetConnectorsQuery";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import { ALLOWED_ARTIST_CONNECTORS } from "./isAllowedArtistConnector";

/**
 * Validated params for getting connectors.
 */
export interface GetConnectorsParams {
  composioEntityId: string;
  allowedToolkits?: readonly string[];
}

/**
 * Validates the full GET /api/connectors request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Query param validation (account_id)
 * 3. Access verification (when account_id is provided)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateGetConnectorsRequest(
  request: NextRequest,
): Promise<NextResponse | GetConnectorsParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication (supports x-api-key and Bearer token)
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate query params
  const { searchParams } = new URL(request.url);
  const validated = validateGetConnectorsQuery(searchParams);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { account_id } = validated;

  // 3. If account_id is provided, verify access and use that entity
  if (account_id) {
    const hasAccess = await checkAccountArtistAccess(accountId, account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this entity" }, { status: 403, headers });
    }

    return {
      composioEntityId: account_id,
      allowedToolkits: ALLOWED_ARTIST_CONNECTORS,
    };
  }

  // No account_id: use the authenticated account
  return {
    composioEntityId: accountId,
  };
}
