import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { v4 as uuidV4 } from "uuid";

export async function createStripeSession(
  accountId: string,
  successUrl: string,
): Promise<Stripe.Checkout.Session> {
  const metadata: Stripe.MetadataParam = { accountId };

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    line_items: [
      {
        price: "price_1RyDFD00JObOnOb53PcVOeBz",
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: uuidV4(),
    metadata,
    subscription_data: {
      metadata,
      trial_period_days: 30,
    },
    success_url: successUrl,
  };

  return stripeClient.checkout.sessions.create(sessionData);
}
