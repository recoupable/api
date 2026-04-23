import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSubscriptionRequest } from "@/lib/subscriptions/validateGetSubscriptionRequest";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { isEnterprise } from "@/lib/enterprise/isEnterprise";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";

/**
 * Handler for GET /api/accounts/{id}/subscription.
 *
 * Response body mirrors the legacy Express `/api/subscriptions?accountId=...`
 * endpoint. The `subscription` field is a raw `Stripe.Subscription` — its
 * fields stay camelCase by design (third-party typed payload), even though
 * the rest of the API uses snake_case.
 *
 * @returns 200 with `{ status, subscription }` or `{ status, isEnterprise }`,
 *   or 400/401/403/404/500 on error.
 */
export async function getSubscriptionsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetSubscriptionRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { accountId } = validated;

    const accountEmails = await selectAccountEmails({ accountIds: accountId });
    if (!accountEmails || accountEmails.length === 0) {
      return NextResponse.json(
        { status: "error", error: "Account not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    const isAccountEnterprise = accountEmails.some(record => isEnterprise(record.email || ""));
    if (isAccountEnterprise) {
      return NextResponse.json(
        { status: "success", isEnterprise: true },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const subscription = await getActiveSubscriptionDetails(accountId);
    if (!subscription) {
      return NextResponse.json(
        { status: "error", error: "No active subscription found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { status: "success", subscription },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSubscriptionsHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
