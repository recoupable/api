import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCheckoutSession } from "@/lib/stripe/checkout/createCheckoutSession";
import { resolveCheckoutPrice } from "@/lib/stripe/checkout/resolveCheckoutPrice";
import { validateCreateCheckoutRequest } from "@/lib/stripe/checkout/validateCreateCheckoutRequest";

/**
 * `POST /api/subscriptions/checkout`: Stripe-first checkout for Starter or
 * Pro, no account required. Same `{ id, url }` response as
 * `/api/subscriptions/sessions`.
 */
export async function createCheckoutHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateCheckoutRequest(request);
    if (validated instanceof NextResponse) return validated;

    const price = resolveCheckoutPrice(validated.plan);
    if (!price) {
      return NextResponse.json(
        { error: "starter_unavailable" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const session = await createCheckoutSession({ ...validated, price });
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
    console.error("[createCheckoutHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
