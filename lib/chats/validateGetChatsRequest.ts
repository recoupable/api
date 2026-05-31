import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { RECOUP_ORG_ID } from "@/lib/const";

const getChatsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

/**
 * Validated scope params for the chats listing.
 * `accountIds === undefined` signals admin scope (no account filter).
 * `artistAccountId` is a separate, composable filter on `sessions.artist_id`.
 */
export interface GetChatsScope {
  accountIds?: string[];
  artistAccountId?: string;
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
 *
 * Recoup-admin status is derived from `account_organization_ids` membership
 * (not `auth.orgId`) because Bearer-authed callers never set `auth.orgId` —
 * the previous `orgId === RECOUP_ORG_ID` branch was unreachable for them.
 *
 * `artistAccountId` (from `?artist_account_id=`) passes through verbatim
 * and composes with the account scope at the SQL layer.
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

  const { account_id: targetAccountId, artist_account_id: artistAccountId } = queryResult.data;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

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
    return { accountIds: [targetAccountId], artistAccountId };
  }

  // Recoup admin → all chats. Check membership directly so Bearer-authed
  // admins get the same scope as x-api-key admins (auth.orgId is null for
  // Bearer regardless of the caller's org memberships).
  const callerOrgs = await getAccountOrganizations({ accountId });
  const isRecoupAdmin = callerOrgs.some(m => m.organization_id === RECOUP_ORG_ID);
  if (isRecoupAdmin) {
    return { accountIds: undefined, artistAccountId };
  }

  return { accountIds: [accountId], artistAccountId };
}
