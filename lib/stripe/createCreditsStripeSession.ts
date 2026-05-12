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
}

export async function createCreditsStripeSession({
  accountId,
  credits,
  successUrl,
}: CreateCreditsStripeSessionParams): Promise<Stripe.Checkout.Session> {
  const metadata = {
    accountId,
    credits: String(credits),
    purpose: CREDIT_TOPUP_PURPOSE,
  };

  const { feeCents } = computeCreditsTopupCharge(credits);

  const sessionData: Stripe.Checkout.SessionCreateParams = {
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
    payment_intent_data: { metadata },
    success_url: successUrl,
  };

  return stripeClient.checkout.sessions.create(sessionData);
}
