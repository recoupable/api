import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import type { CheckoutPlan } from "@/lib/stripe/checkout/checkoutPlan";
import type { CheckoutPrice } from "@/lib/stripe/checkout/resolveCheckoutPrice";
import { CHECKOUT_UNAUTH_SOURCE } from "@/lib/stripe/checkout/checkoutUnauthSource";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";

export type CreateStripeSessionArgs = {
  accountId: string | null;
  plan: CheckoutPlan;
  price: CheckoutPrice;
  successUrl: string;
  cancelUrl?: string;
};

/**
 * Mints a Stripe Checkout session for Starter or Pro. Authenticated: the
 * account's customer and `accountId` metadata. Anonymous: no `customer`
 * (Stripe creates one from the typed email in subscription mode); the
 * `checkout.session.completed` webhook links or creates the account.
 */
export async function createStripeSession(
  args: CreateStripeSessionArgs,
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
  }

  return stripeClient.checkout.sessions.create(params);
}
