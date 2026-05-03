import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { mapToSubscriptionSessionError } from "@/lib/stripe/mapToSubscriptionSessionError";

export const subscriptionStatusQuerySchema = z.object({
  accountId: z
    .string({ message: "accountId is required" })
    .min(1, "accountId is required")
    .uuid("accountId must be a valid UUID"),
});

export type ValidatedSubscriptionStatusQuery = z.infer<typeof subscriptionStatusQuerySchema>;

/**
 * Validates GET /api/subscriptions/status: query `accountId`, auth, and account access.
 */
export async function validateSubscriptionStatusQuery(
  request: NextRequest,
): Promise<ValidatedSubscriptionStatusQuery | NextResponse> {
  const raw = request.nextUrl.searchParams.get("accountId");
  const parsed = subscriptionStatusQuerySchema.safeParse({
    accountId: raw ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400, headers: getCorsHeaders() });
  }

  const { accountId } = parsed.data;

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
