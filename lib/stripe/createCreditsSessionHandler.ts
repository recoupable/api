import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/creditsTopupPurpose";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { computeCreditsTopupCharge } from "@/lib/stripe/computeCreditsTopupCharge";
import { createCreditsStripeSession } from "@/lib/stripe/createCreditsStripeSession";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { validateCreateCreditsSessionRequest } from "@/lib/stripe/validateCreateCreditsSessionRequest";

const cors = () => getCorsHeaders();

export async function createCreditsSessionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateCreditsSessionRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { accountId, credits, successUrl } = validated;
    const customer = await resolveStripeCustomerForAccount(accountId);
    const { totalCents } = computeCreditsTopupCharge(credits);

    const charge = await chargeCustomerOffSession({
      customer,
      totalCents,
      metadata: {
        accountId,
        credits: String(credits),
        purpose: CREDIT_TOPUP_PURPOSE,
      },
    });

    if (charge.kind === "charged") {
      return NextResponse.json(
        {
          paymentIntentId: charge.paymentIntentId,
          creditsPurchased: credits,
          totalCents,
        },
        { status: 200, headers: cors() },
      );
    }

    // No card on file, or card requires 3-D Secure / was declined — fall back
    // to Checkout. When we have a Stripe decline reason from the off-session
    // attempt, surface it so callers can tell their human "insufficient funds"
    // instead of just opening Checkout silently.
    const session = await createCreditsStripeSession({
      accountId,
      credits,
      successUrl,
      customer,
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Checkout session URL missing" },
        { status: 400, headers: cors() },
      );
    }
    return NextResponse.json(
      {
        id: session.id,
        url: session.url,
        ...(charge.kind === "requires_action" && charge.declineReason
          ? { declineReason: charge.declineReason }
          : {}),
      },
      { status: 200, headers: cors() },
    );
  } catch (error) {
    console.error("[createCreditsSessionHandler]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: cors() });
  }
}
