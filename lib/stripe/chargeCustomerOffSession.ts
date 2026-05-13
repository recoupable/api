import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

interface ChargeParams {
  customer: string;
  totalCents: number;
  metadata: { accountId: string; credits: string; purpose: string };
}

export type OffSessionChargeResult =
  | { kind: "charged"; paymentIntentId: string }
  | { kind: "requires_action" }
  | { kind: "no_payment_method" };

/**
 * Attempt an off-session PaymentIntent against the Customer's saved card.
 * Falls back cleanly when no card is on file or when the card requires
 * 3-D Secure (authentication_required); the caller can then route to a
 * Checkout Session so the customer can complete the payment in-browser.
 */
export async function chargeCustomerOffSession({
  customer,
  totalCents,
  metadata,
}: ChargeParams): Promise<OffSessionChargeResult> {
  const paymentMethodId = await findDefaultPaymentMethodForCustomer(customer);
  if (!paymentMethodId) {
    return { kind: "no_payment_method" };
  }

  const params: Stripe.PaymentIntentCreateParams = {
    amount: totalCents,
    currency: "usd",
    customer,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,
    metadata: { ...metadata, paymentMethod: "off_session" },
  };

  // Intentionally NO server-generated idempotency key on the charge — a user
  // topping up the same amount twice (e.g. $1 today, $1 tomorrow) is a valid
  // intent and should produce two distinct PaymentIntents. The Customer-level
  // idempotency from PR 2a (resolveStripeCustomerForAccount, keyed on
  // accountId only) is the right scope. Follow-up: accept a client-supplied
  // Idempotency-Key header for safe network-retry dedupe per attempt.
  try {
    const pi = await stripeClient.paymentIntents.create(params);
    if (pi.status === "requires_action") {
      return { kind: "requires_action" };
    }
    return { kind: "charged", paymentIntentId: pi.id };
  } catch (error) {
    const e = error as { type?: string; code?: string };
    if (e?.type === "StripeCardError" && e.code === "authentication_required") {
      return { kind: "requires_action" };
    }
    console.error("[chargeCustomerOffSession]", error);
    throw error;
  }
}
