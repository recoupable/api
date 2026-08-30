import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import {
  STRIPE_STARTER_PRICE_ID,
  STRIPE_SUBSCRIPTION_PRICE_ID,
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
} from "@/lib/stripe/config";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";
import { StarterUnavailableError } from "@/lib/stripe/StarterUnavailableError";

export type CheckoutPlan = "starter" | "pro";

/**
 * Mints the subscription Checkout Session for an account. Pro carries the
 * 30-day trial; Starter is charged at checkout and needs the Starter price to
 * be configured. `plan` is stamped on the session and the subscription so the
 * webhook and sales notes can read it without a price lookup.
 */
export async function createStripeSession(
  accountId: string,
  successUrl: string,
  plan: CheckoutPlan = "pro",
): Promise<Stripe.Checkout.Session> {
  if (plan === "starter" && !STRIPE_STARTER_PRICE_ID) {
    throw new StarterUnavailableError();
  }
  const metadata = { accountId, plan };
  const customer = await resolveStripeCustomerForAccount(accountId);

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    customer,
    line_items: [
      {
        price: plan === "starter" ? STRIPE_STARTER_PRICE_ID : STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: accountId,
    metadata,
    subscription_data:
      plan === "starter"
        ? { metadata }
        : { metadata, trial_period_days: STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS },
    success_url: successUrl,
  };

  return stripeClient.checkout.sessions.create(sessionData);
}
