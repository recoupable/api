import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

export const getSubscriptionParamsSchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID"),
});

export type GetSubscriptionParams = z.infer<typeof getSubscriptionParamsSchema>;

export interface ValidatedGetSubscriptionRequest {
  accountId: string;
}

/**
 * Validates GET /api/accounts/{id}/subscription: 400 bad UUID, 401 unauth,
 * 404 missing account, 403 no access. The path id is NOT passed as an auth
 * override — doing so would rewrite the caller's id to the target and
 * collapse the access check into a self-check that always passes.
 */
export async function validateGetSubscriptionRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedGetSubscriptionRequest | NextResponse> {
  const parsed = getSubscriptionParamsSchema.safeParse({ account_id: id });
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

  const hasAccess = await canAccessAccount({
    currentAccountId: authResult.accountId,
    targetAccountId: accountId,
  });
  if (!hasAccess) {
    return NextResponse.json(
      { status: "error", error: "Access denied to specified account_id" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { accountId };
}
