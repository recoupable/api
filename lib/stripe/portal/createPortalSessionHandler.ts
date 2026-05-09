import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createPortalSession } from "@/lib/stripe/portal/createPortalSession";
import { validateCreatePortalSessionRequest } from "@/lib/stripe/portal/validateCreatePortalSessionRequest";
import { getStripeCustomerIdByAccountId } from "@/lib/supabase/billing_customers/getStripeCustomerIdByAccountId";

export async function createPortalSessionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreatePortalSessionRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const customerId = await getStripeCustomerIdByAccountId(validated.accountId);
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    const session = await createPortalSession(customerId, validated.returnUrl);
    if (!session.url) {
      return NextResponse.json(
        { error: "Portal session URL missing" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { id: session.id, url: session.url },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[createPortalSessionHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
