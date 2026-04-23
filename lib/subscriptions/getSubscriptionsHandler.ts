import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateGetSubscriptionRequest } from "@/lib/subscriptions/validateGetSubscriptionRequest";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { isEnterprise } from "@/lib/enterprise/isEnterprise";
import { getActiveSubscription } from "@/lib/stripe/getActiveSubscription";

/**
 * Handler for GET /api/accounts/{id}/subscription. The `subscription` field is
 * a raw `Stripe.Subscription` — its keys stay camelCase by design (third-party
 * typed payload), despite the rest of the API being snake_case.
 */
export async function getSubscriptionsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetSubscriptionRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const { account_id } = validated;

    const accountEmails = await selectAccountEmails({ accountIds: account_id });
    if (!accountEmails?.length) return errorResponse("Account not found", 404);

    if (accountEmails.some(record => isEnterprise(record.email || ""))) {
      return NextResponse.json(
        { status: "success", isEnterprise: true },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const subscription = await getActiveSubscription(account_id);
    if (!subscription) return errorResponse("No active subscription found", 404);

    return NextResponse.json(
      { status: "success", subscription },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSubscriptionsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
