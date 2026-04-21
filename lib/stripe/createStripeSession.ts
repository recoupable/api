import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { STRIPE_SUBSCRIPTION_PRICE_ID } from "@/lib/const";

export type StripeSessionResult = {
  id: string;
  url: string;
};

/**
 * Creates a Stripe checkout session for the Recoup subscription plan.
 *
 * Configures a 30-day free trial subscription with the platform's default
 * price. Stores accountId in session metadata so webhook handlers can
 * associate a completed payment with a Recoup account.
 *
 * @param accountId - The Recoup account ID to associate with the session.
 * @param successUrl - The URL to redirect the user to after a successful payment.
 * @returns The Stripe session ID and hosted checkout URL.
 * @throws If the Stripe API call fails or the session has no URL.
 */
export async function createStripeSession(
  accountId: string,
  successUrl: string,
): Promise<StripeSessionResult> {
  const metadata: Stripe.MetadataParam = { accountId };

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    line_items: [
      {
        price: STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: generateUUID(),
    metadata,
    subscription_data: {
      metadata,
      trial_period_days: 30,
    },
    success_url: successUrl,
  };

  const session = await stripeClient.checkout.sessions.create(sessionData);

  if (!session.url) {
    throw new Error("Stripe session was created but returned no URL");
  }

  return { id: session.id, url: session.url };
}
