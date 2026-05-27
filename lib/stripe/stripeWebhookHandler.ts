import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processCreditsTopupPaymentIntent } from "@/lib/stripe/processCreditsTopupPaymentIntent";
import { processCreditsTopupSession } from "@/lib/stripe/processCreditsTopupSession";
import { verifyStripeWebhookEvent } from "@/lib/stripe/verifyStripeWebhookEvent";

export async function stripeWebhookHandler(request: NextRequest): Promise<NextResponse> {
  const verified = await verifyStripeWebhookEvent(request);
  if ("error" in verified) {
    return NextResponse.json({ error: verified.error }, { status: 400, headers: getCorsHeaders() });
  }

  const { event } = verified;

  try {
    if (event.type === "checkout.session.completed") {
      await processCreditsTopupSession(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "payment_intent.succeeded") {
      await processCreditsTopupPaymentIntent(event.data.object as Stripe.PaymentIntent);
    }

    return NextResponse.json({ received: true }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[stripeWebhookHandler]", { eventId: event.id, eventType: event.type, error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
