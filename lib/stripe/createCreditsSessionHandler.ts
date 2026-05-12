import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";

export async function createCreditsSessionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateCreditsSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const session = await createCreditsStripeSession(validated);
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
    console.error("[createCreditsSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
