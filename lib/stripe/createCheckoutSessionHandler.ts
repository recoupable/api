import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { validateCreateCheckoutSessionRequest } from "@/lib/stripe/validateCreateCheckoutSessionRequest";

export async function createCheckoutSessionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateCheckoutSessionRequest(request);
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
    console.error("[createCheckoutSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
