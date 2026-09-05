import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";
import { validateCreatePaymentMethodSessionRequest } from "@/lib/billing/validateCreatePaymentMethodSessionRequest";

/**
 * `POST /api/accounts/{id}/payment-method`: mint a $0 Stripe `setup` Checkout
 * session that saves a card for the account (or member organization) in the path.
 */
export async function createPaymentMethodSessionHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateCreatePaymentMethodSessionRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const session = await createCardOnFileSession(validated.accountId, validated.successUrl);
    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session URL missing" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { id: session.id, url: session.url },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[createPaymentMethodSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
