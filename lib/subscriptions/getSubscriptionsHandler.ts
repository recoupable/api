import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateGetSubscriptionRequest } from "@/lib/subscriptions/validateGetSubscriptionRequest";
import { getAccountSubscription } from "@/lib/subscriptions/getAccountSubscription";

/**
 * Handler for GET /api/accounts/{id}/subscription. When the account is a paid
 * Stripe customer, `subscription` is a raw `Stripe.Subscription` — its keys
 * stay camelCase by design (third-party typed payload), despite the rest of
 * the API being snake_case.
 */
export async function getSubscriptionsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetSubscriptionRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const result = await getAccountSubscription(validated.account_id);
    if (!result) return errorResponse("No active subscription found", 404);

    return NextResponse.json(
      { status: "success", ...result },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSubscriptionsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
