import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { resolveCheckoutPrice } from "@/lib/stripe/checkout/resolveCheckoutPrice";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";

/**
 * `POST /api/subscriptions/sessions`: Stripe Checkout for Starter or Pro.
 * Auth optional — anonymous sessions are linked on `checkout.session.completed`.
 */
export async function createSubscriptionSessionHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateCreateSubscriptionSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const price = resolveCheckoutPrice(validated.plan);
    if (!price) {
      return NextResponse.json(
        { error: "starter_unavailable" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const session = await createStripeSession({ ...validated, price });
    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session URL missing" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { id: session.id, url: session.url },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[createSubscriptionSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
