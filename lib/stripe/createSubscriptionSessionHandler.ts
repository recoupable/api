import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";

export async function createSubscriptionSessionHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateCreateSubscriptionSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const session = await createStripeSession(validated.accountId, validated.successUrl);
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
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 400, headers: getCorsHeaders() });
  }
}
