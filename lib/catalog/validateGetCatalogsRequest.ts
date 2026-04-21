import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountAccess } from "@/lib/accounts/checkAccountAccess";

/**
 * Params for GET /api/accounts/{id}/catalogs.
 *
 * `z.coerce` is intentionally harmless here (ids are strings) but we keep a
 * single `*ParamsSchema` so the shape can be reused from any future MCP tool
 * without needing a second camelCase copy.
 */
export const getCatalogsParamsSchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID"),
});

export type GetCatalogsParams = z.infer<typeof getCatalogsParamsSchema>;

export interface ValidatedGetCatalogsRequest {
  /** Target account ID (from the path). Name matches `getCatalogsForAccounts([accountId])`. */
  accountId: string;
}

/**
 * Validates GET /api/accounts/{id}/catalogs.
 *
 * Enforces the `auth != access` convention:
 * 1. Parse `id` as a UUID (400 on bad input).
 * 2. `validateAuthContext(request)` (401 on missing / invalid auth). The
 *    target account id from the path is NOT passed as an override — doing so
 *    would rewrite `authResult.accountId` to the target, collapsing the
 *    subsequent access check into a self-check that always returns true.
 * 3. `selectAccounts(id)` -> 404 if the account does not exist.
 * 4. `checkAccountAccess(callerAccountId, id)` -> 403 if the caller cannot
 *    see that account's catalogs. Fails closed. Mirrors the canonical
 *    pattern in `lib/artists/validateDeleteArtistRequest.ts`.
 *
 * Returns the snake_case field the business fn consumes (`accountId`) so the
 * handler can pass the validator result straight through with no remap.
 *
 * @param request - Incoming request (for auth headers)
 * @param id - The account ID from the route path
 * @returns `{ accountId }` or a `NextResponse` error
 */
export async function validateGetCatalogsRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedGetCatalogsRequest | NextResponse> {
  const parsed = getCatalogsParamsSchema.safeParse({ account_id: id });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const accountId = parsed.data.account_id;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const existing = await selectAccounts(accountId);
  if (!existing.length) {
    return NextResponse.json(
      { status: "error", error: "Account not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const hasAccess = await checkAccountAccess(authResult.accountId, accountId);
  if (!hasAccess) {
    return NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { accountId };
}
