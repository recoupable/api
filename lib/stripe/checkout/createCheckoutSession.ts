import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import type { CheckoutPlan } from "@/lib/stripe/checkout/checkoutPlan";
import type { CheckoutPrice } from "@/lib/stripe/checkout/resolveCheckoutPrice";
import { CHECKOUT_UNAUTH_SOURCE } from "@/lib/stripe/checkout/checkoutUnauthSource";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";

export type CreateCheckoutSessionArgs = {
  accountId: string | null;
  plan: CheckoutPlan;
  price: CheckoutPrice;
  successUrl: string;
  cancelUrl?: string;
};

/**
 * Mints the Stripe Checkout for a plan. Authenticated: the account's
 * customer and `accountId` metadata, exactly like `createStripeSession`.
 * Anonymous: Stripe creates the customer from the typed email and the
 * `checkout.session.completed` webhook links or creates the account.
 * Metadata is mirrored onto `subscription_data` so the subscription itself
 * carries the plan.
 */
export async function createCheckoutSession(
  args: CreateCheckoutSessionArgs,
): Promise<Stripe.Checkout.Session> {
  const { accountId, plan, price, successUrl, cancelUrl } = args;
  const metadata = accountId ? { accountId, plan } : { plan, source: CHECKOUT_UNAUTH_SOURCE };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: price.price, quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      ...(price.trialPeriodDays ? { trial_period_days: price.trialPeriodDays } : {}),
    },
    success_url: successUrl,
    ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
  };

  if (accountId) {
    params.customer = await resolveStripeCustomerForAccount(accountId);
    params.client_reference_id = accountId;
  } else {
    params.customer_creation = "always";
  }

  return stripeClient.checkout.sessions.create(params);
}
