import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { StarterUnavailableError } from "@/lib/stripe/StarterUnavailableError";

export async function createSubscriptionSessionHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateCreateSubscriptionSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const session = await createStripeSession(
      validated.accountId,
      validated.successUrl,
      validated.plan,
    );
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
    if (error instanceof StarterUnavailableError) {
      return NextResponse.json(
        { error: "starter_unavailable" },
        { status: 400, headers: getCorsHeaders() },
      );
    }
    console.error("[createSubscriptionSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
