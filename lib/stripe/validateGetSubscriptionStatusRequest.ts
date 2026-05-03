import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export type ValidatedGetSubscriptionStatusRequest = {
  accountId: string;
};

/**
 * Validates GET /api/subscriptions/status: required query `accountId` (UUID),
 * auth, and access to the target account (same rules as body account_id override).
 */
export async function validateGetSubscriptionStatusRequest(
  request: NextRequest,
): Promise<ValidatedGetSubscriptionStatusRequest | NextResponse> {
  const raw = request.nextUrl.searchParams.get("accountId");
  if (raw === null || raw.trim() === "") {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsedUuid = z.string().uuid("accountId must be a valid UUID").safeParse(raw);
  if (!parsedUuid.success) {
    const first = parsedUuid.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const accountId = parsedUuid.data;

  const authContext = await validateAuthContext(request);
  if (authContext instanceof NextResponse) {
    return await mapToSubscriptionSessionError(authContext);
  }

  const override = await validateAccountIdOverride({
    currentAccountId: authContext.accountId,
    targetAccountId: accountId,
  });
  if (override instanceof NextResponse) {
    return await mapToSubscriptionSessionError(override);
  }

  return { accountId: override.accountId };
}
