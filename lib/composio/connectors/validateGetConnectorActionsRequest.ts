import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetConnectorActionsQuery } from "./validateGetConnectorActionsQuery";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";

/**
 * Validated params for getting connector actions.
 */
export interface GetConnectorActionsParams {
  /** Authenticated account (from the bearer token / api key). */
  accountId: string;
  /**
   * Optional artist account scope — when provided, the actions catalog
   * also includes the artist's connected toolkits. Required for any
   * toolkit (e.g. YouTube, TikTok, Instagram) that's connected at the
   * artist level.
   */
  artistId?: string;
}

/**
 * Validates the full GET /api/connectors/actions request.
 *
 * Handles:
 * 1. Authentication (x-api-key or Bearer token)
 * 2. Query param validation (account_id)
 * 3. Access verification (when account_id is provided)
 *
 * @param request - The incoming request
 * @returns NextResponse error or validated params
 */
export async function validateGetConnectorActionsRequest(
  request: NextRequest,
): Promise<NextResponse | GetConnectorActionsParams> {
  const headers = getCorsHeaders();

  // 1. Validate authentication (supports x-api-key and Bearer token)
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  // 2. Validate query params
  const { searchParams } = new URL(request.url);
  const validated = validateGetConnectorActionsQuery(searchParams);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { account_id } = validated;

  // 3. If account_id is provided, verify access and use it as the artist scope.
  //    Keep the authenticated accountId separate so getComposioTools' merged
  //    customer/artist/shared catalog can resolve artist-only toolkits via the
  //    artist owner scope (where non-meta tools survive).
  if (account_id) {
    const accessResult = await checkAccountAccess(accountId, account_id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this account" },
        { status: 403, headers },
      );
    }

    return { accountId, artistId: account_id };
  }

  // No account_id: use the authenticated account
  return { accountId };
}
