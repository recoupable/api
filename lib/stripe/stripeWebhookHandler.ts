import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { verifyStripeWebhookEvent } from "@/lib/stripe/verifyStripeWebhookEvent";
import { processCreditsTopupSession } from "@/lib/stripe/processCreditsTopupSession";

export async function stripeWebhookHandler(request: NextRequest): Promise<NextResponse> {
  const verified = await verifyStripeWebhookEvent(request);
  if ("error" in verified) {
    return NextResponse.json({ error: verified.error }, { status: 400, headers: getCorsHeaders() });
  }

  const { event } = verified;

  try {
    if (event.type === "checkout.session.completed") {
      await processCreditsTopupSession(event.data.object as Stripe.Checkout.Session);
    }

    return NextResponse.json({ received: true }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[stripeWebhookHandler]", { eventId: event.id, eventType: event.type, error });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
