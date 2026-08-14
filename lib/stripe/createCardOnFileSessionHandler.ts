import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";
import { validateCreateCardOnFileSessionRequest } from "@/lib/stripe/validateCreateCardOnFileSessionRequest";

/**
 * Handle a card-on-file session request: validate, then mint a $0 Stripe
 * `setup` session that saves a card for the authenticated account.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with session `id` and `url`, or an error body.
 */
export async function createCardOnFileSessionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateCardOnFileSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const session = await createCardOnFileSession(validated.accountId, validated.successUrl);
    // The caller cannot correct a session Stripe returned without a URL, so
    // this is a 500 rather than the sibling subscription route's 400.
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
    console.error("[createCardOnFileSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
