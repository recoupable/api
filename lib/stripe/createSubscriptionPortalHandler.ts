import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectBillingCustomers } from "@/lib/supabase/billing_customers/selectBillingCustomers";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";

export async function createSubscriptionPortalHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateSubscriptionPortalBody(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const [billingCustomer] = await selectBillingCustomers({
      accountId: validated.accountId,
      provider: "stripe",
    });
    if (!billingCustomer) {
      return NextResponse.json(
        { error: "Billing customer not found" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const session = await createBillingPortalSession(
      billingCustomer.customer_id,
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
    console.error("[createSubscriptionPortalHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
