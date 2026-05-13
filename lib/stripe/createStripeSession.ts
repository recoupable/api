import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import {
  STRIPE_SUBSCRIPTION_PRICE_ID,
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
} from "@/lib/stripe/config";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";

export async function createStripeSession(
  accountId: string,
  successUrl: string,
): Promise<Stripe.Checkout.Session> {
  const metadata = { accountId };
  const customer = await resolveStripeCustomerForAccount(accountId);

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    customer,
    line_items: [
      {
        price: STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: accountId,
    metadata,
    subscription_data: {
      metadata,
      trial_period_days: STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
    },
    success_url: successUrl,
  };

  return stripeClient.checkout.sessions.create(sessionData);
}
