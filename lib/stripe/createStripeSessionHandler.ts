import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateStripeSessionBody } from "@/lib/stripe/validateCreateStripeSessionBody";
import { createStripeSession } from "@/lib/stripe/createStripeSession";

/**
 * Handler for POST /api/subscriptions/sessions.
 *
 * Creates a Stripe checkout session for the authenticated account and returns
 * the session ID and hosted checkout URL. The client should redirect the user
 * to the returned URL to complete the subscription flow.
 *
 * @param request - The NextRequest object.
 * @returns A NextResponse with { id, url } on success, or an error response.
 */
export async function createStripeSessionHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateStripeSessionBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const session = await createStripeSession(validated.accountId, validated.successUrl);

    return NextResponse.json(session, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Failed to create Stripe subscription session", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
