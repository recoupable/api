import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/creditsTopupPurpose";
import { computeCreditsTopupCharge } from "@/lib/stripe/computeCreditsTopupCharge";

/**
 * One credit equals one US cent ($0.01). Total charge = unit_amount * credits.
 */
const UNIT_AMOUNT_CENTS_PER_CREDIT = 1;

interface CreateCreditsStripeSessionParams {
  accountId: string;
  credits: number;
  successUrl: string;
  customer: string;
}

/**
 * Create a Checkout Session for the credits top-up fallback flow.
 *
 * Always passes an explicit `customer` so the Customer record stays
 * linked to the Recoup account (via `metadata.accountId` stamped during
 * PR 2a). The session sets `payment_intent_data.setup_future_usage:
 * "off_session"` so the card the customer enters gets saved to that
 * Customer — the next top-up against the same account can then auto-
 * charge it via `chargeCustomerOffSession`.
 *
 * Metadata is stamped on the Session and on the PaymentIntent the
 * Session creates. The PaymentIntent's `paymentMethod: "checkout"` flag
 * distinguishes it from off-session credits PaymentIntents so the
 * `payment_intent.succeeded` webhook handler can skip it (the Checkout
 * webhook handles those).
 */
export async function createCreditsStripeSession({
  accountId,
  credits,
  successUrl,
  customer,
}: CreateCreditsStripeSessionParams): Promise<Stripe.Checkout.Session> {
  const metadata = {
    accountId,
    credits: String(credits),
    purpose: CREDIT_TOPUP_PURPOSE,
  };

  const { feeCents } = computeCreditsTopupCharge(credits);

  const sessionData: Stripe.Checkout.SessionCreateParams = {
    customer,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: UNIT_AMOUNT_CENTS_PER_CREDIT,
          product_data: { name: "Recoup credits" },
        },
        quantity: credits,
      },
      {
        price_data: {
          currency: "usd",
          unit_amount: feeCents,
          product_data: { name: "Processing fee" },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    client_reference_id: accountId,
    metadata,
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: { ...metadata, paymentMethod: "checkout" },
    },
    success_url: successUrl,
  };

  return stripeClient.checkout.sessions.create(sessionData);
}
