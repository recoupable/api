import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { RECOUP_ORG_ID } from "@/lib/const";

const getChatsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  // `artist_account_id` is parsed and validated, but does not yet filter
  // — `sessions.artist_id` isn't populated, so the filter has nothing to
  // match. The schema stays so the filter starts working transparently
  // once the artist column lands.
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

/**
 * Validated scope params for the chats listing.
 * `accountIds === undefined` signals admin scope (no account filter).
 */
export interface GetChatsScope {
  accountIds?: string[];
}

/**
 * Validates GET /api/chats request.
 *
 * Auth via x-api-key or Authorization Bearer token. Returns the account scope:
 * - Recoup admin (no target) → `{ accountIds: undefined }` (all chats).
 * - Recoup admin with `account_id` → `{ accountIds: [target] }`.
 * - Org/personal key with `account_id` → `{ accountIds: [target] }` if
 *   `canAccessAccount` allows, else 403.
 * - Personal/org key without target → `{ accountIds: [callerAccountId] }`.
 */
export async function validateGetChatsRequest(
  request: NextRequest,
): Promise<NextResponse | GetChatsScope> {
  const { searchParams } = new URL(request.url);
  const queryResult = getChatsQuerySchema.safeParse({
    account_id: searchParams.get("account_id") ?? undefined,
    artist_account_id: searchParams.get("artist_account_id") ?? undefined,
  });
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { account_id: targetAccountId } = queryResult.data;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId, orgId } = authResult;

  if (targetAccountId) {
    const hasAccess = await canAccessAccount({
      targetAccountId,
      currentAccountId: accountId,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
    return { accountIds: [targetAccountId] };
  }

  // Recoup admin → all chats.
  if (orgId === RECOUP_ORG_ID) {
    return { accountIds: undefined };
  }

  return { accountIds: [accountId] };
}
