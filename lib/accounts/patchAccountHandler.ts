import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePatchAccountRequest } from "@/lib/accounts/validateUpdateAccountBody";
import { updateAccountHandler } from "@/lib/accounts/updateAccountHandler";
import type { ValidatedUpdateAccountRequest } from "@/lib/accounts/validateUpdateAccountRequest";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";

/**
 * Handles PATCH /api/accounts: optional admin-only accountId override, then profile update.
 * Auth and body validation live in {@link validatePatchAccountRequest}.
 *
 * @param req - Incoming Next.js request
 * @returns Updated account JSON or error response
 */
export async function patchAccountHandler(req: NextRequest): Promise<NextResponse> {
  const validatedRequest = await validatePatchAccountRequest(req);
  if (validatedRequest instanceof NextResponse) {
    return validatedRequest;
  }

  const { auth: authResult, body: validated } = validatedRequest;

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
    ...(validated as Omit<ValidatedUpdateAccountRequest, "accountId">),
    accountId: targetAccountId,
  });
}
