import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreatePortalParams } from "@/lib/billing/validateCreatePortalParams";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";

/**
 * POST /api/accounts/{id}/portal: opens a Stripe Customer Portal session for
 * the account in the path (own account or a member organization). The
 * customer is the one on the account's active subscription; accounts with
 * no subscription get a 400 rather than a portal for an empty customer.
 */
export async function createPortalSessionHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateCreatePortalParams(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const subscription = await getActiveSubscriptionDetails(validated.accountId);
    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const session = await createBillingPortalSession(
      subscription.customer as string,
      validated.returnUrl,
    );
    if (!session.url) {
      return NextResponse.json(
        { error: "Billing portal URL missing" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { id: session.id, url: session.url },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[createPortalSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
