import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { notifyCreditsTopupPaymentIntent } from "@/lib/stripe/notifyCreditsTopupPaymentIntent";
import { notifyCreditsTopupSession } from "@/lib/stripe/notifyCreditsTopupSession";
import { processCreditsTopupPaymentIntent } from "@/lib/stripe/processCreditsTopupPaymentIntent";
import { processCreditsTopupSession } from "@/lib/stripe/processCreditsTopupSession";
import { processInvoicePaid } from "@/lib/stripe/processInvoicePaid";
import { processSubscriptionCreated } from "@/lib/stripe/processSubscriptionCreated";
import { processSubscriptionDeleted } from "@/lib/stripe/processSubscriptionDeleted";
import { processSubscriptionTrialWillEnd } from "@/lib/stripe/processSubscriptionTrialWillEnd";
import { processSubscriptionUpdated } from "@/lib/stripe/processSubscriptionUpdated";
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
      await notifyCreditsTopupSession(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "payment_intent.succeeded") {
      await processCreditsTopupPaymentIntent(event.data.object as Stripe.PaymentIntent);
      await notifyCreditsTopupPaymentIntent(event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "invoice.paid") {
      await processInvoicePaid(event.data.object as Stripe.Invoice);
    } else if (event.type === "customer.subscription.created") {
      await processSubscriptionCreated(event.data.object as Stripe.Subscription);
    } else if (event.type === "customer.subscription.trial_will_end") {
      await processSubscriptionTrialWillEnd(event.data.object as Stripe.Subscription);
    } else if (event.type === "customer.subscription.updated") {
      await processSubscriptionUpdated(
        event.data.object as Stripe.Subscription,
        event.data.previous_attributes as Partial<Stripe.Subscription> | undefined,
      );
    } else if (event.type === "customer.subscription.deleted") {
      await processSubscriptionDeleted(event.data.object as Stripe.Subscription);
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
