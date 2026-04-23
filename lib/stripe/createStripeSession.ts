import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { STRIPE_SUBSCRIPTION_PRICE_ID } from "@/lib/const";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

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
  if (!STRIPE_SUBSCRIPTION_PRICE_ID) {
    throw new Error("Failed to create Stripe session");
  }

  const metadata: Stripe.MetadataParam = { accountId };
  const accountEmails = await selectAccountEmails({ accountIds: accountId });
  const customerEmail = accountEmails.find(
    accountEmail => typeof accountEmail.email === "string",
  )?.email;

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    line_items: [
      {
        price: STRIPE_SUBSCRIPTION_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: "subscription",
    client_reference_id: accountId,
    metadata,
    customer_email: customerEmail,
    cancel_url: successUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
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
