import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateStripeSessionBody } from "@/lib/stripe/validateCreateStripeSessionBody";
import { createStripeSession } from "@/lib/stripe/createStripeSession";

/** POST /api/subscriptions/sessions — returns `{ id, url }` for hosted Stripe checkout. */
export async function createSubscriptionSessionHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const validated = await validateCreateStripeSessionBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const session = await createStripeSession(validated.accountId, validated.successUrl);

    return NextResponse.json(session, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Failed to create subscription checkout session", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
