import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import {
  validateUpdateAccountBody,
  type UpdateAccountBody,
} from "@/lib/accounts/validateUpdateAccountBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { updateAccountHandler } from "@/lib/accounts/updateAccountHandler";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";

/**
 * Handles PATCH /api/accounts: auth, optional admin-only accountId override, then profile update.
 *
 * @param req - Incoming Next.js request
 * @returns Updated account JSON or error response
 */
export async function patchAccountHandler(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await safeParseJson(req);

  const validated = validateUpdateAccountBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const targetAccountId = validated.accountId ?? authResult.accountId;
  if (validated.accountId && validated.accountId !== authResult.accountId) {
    const isAdmin = await checkIsAdmin(authResult.accountId);
    if (!isAdmin) {
      return NextResponse.json(
        { status: "error", error: "accountId override is only allowed for admin accounts" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return updateAccountHandler({
    ...(validated as UpdateAccountBody),
    accountId: targetAccountId,
  });
}
