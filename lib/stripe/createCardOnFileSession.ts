import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { resolveStripeCustomerForAccount } from "@/lib/stripe/resolveStripeCustomerForAccount";

/**
 * A Stripe Checkout session that **only collects a card on file** — `mode:
 * "setup"`, $0, no subscription or price. This is the "free tier": the account
 * saves a payment method (so metered Songstats usage can be charged later via
 * the credits system) without committing to any recurring plan. Needs no Stripe
 * product. Contrast with {@link createStripeSession}, which is the paid
 * subscription flow.
 *
 * @param accountId - The account to attach the card to.
 * @param successUrl - Where Stripe redirects after the card is saved.
 */
export async function createCardOnFileSession(
  accountId: string,
  successUrl: string,
): Promise<Stripe.Checkout.Session> {
  const metadata = { accountId };
  const customer = await resolveStripeCustomerForAccount(accountId);

  return stripeClient.checkout.sessions.create({
    customer,
    mode: "setup",
    currency: "usd",
    client_reference_id: accountId,
    metadata,
    success_url: successUrl,
  });
}
