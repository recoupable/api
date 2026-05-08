import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";

export async function createSubscriptionPortalHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateSubscriptionPortalBody(request);
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
    console.error("[createSubscriptionPortalHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
