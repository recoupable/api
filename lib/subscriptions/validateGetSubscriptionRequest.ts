import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

export const getSubscriptionParamsSchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID"),
});

export type GetSubscriptionParams = z.infer<typeof getSubscriptionParamsSchema>;

/**
 * Bundles auth, path-id parsing, account existence (404), and account-access
 * check (403). Path id is not passed as an auth override — that would collapse
 * the access check into a self-check that always passes.
 */
export async function validateGetSubscriptionRequest(
  request: NextRequest,
  id: string,
): Promise<GetSubscriptionParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const parsed = getSubscriptionParamsSchema.safeParse({ account_id: id });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const [account] = await selectAccounts(parsed.data.account_id);
  if (!account) return errorResponse("Account not found", 404);

  const hasAccess = await canAccessAccount({
    currentAccountId: authResult.accountId,
    targetAccountId: parsed.data.account_id,
  });
  if (!hasAccess) return errorResponse("Unauthorized", 403);

  return parsed.data;
}
