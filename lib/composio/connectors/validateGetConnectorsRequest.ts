import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountIdHeaders } from "@/lib/accounts/validateAccountIdHeaders";
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
 * 2. Query param validation (entity_type, entity_id)
 * 3. Access verification (for artist entities)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateGetConnectorsRequest(
  request: NextRequest,
): Promise<NextResponse | GetConnectorsParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication
  const authResult = await validateAccountIdHeaders(request);
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
  const { entity_type, entity_id } = validated;

  // 3. Verify access and determine params
  if (entity_type === "artist") {
    const hasAccess = await checkAccountArtistAccess(accountId, entity_id!);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this artist" },
        { status: 403, headers },
      );
    }

    return {
      composioEntityId: entity_id!,
      allowedToolkits: ALLOWED_ARTIST_CONNECTORS,
    };
  }

  return {
    composioEntityId: accountId,
  };
}
