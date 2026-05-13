import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

interface ChargeParams {
  customer: string;
  totalCents: number;
  metadata: { accountId: string; credits: string; purpose: string };
}

export type DeclineReason = {
  /** Stripe error code, e.g. "card_declined", "expired_card", "authentication_required". */
  code: string;
  /** Stripe decline_code on `card_declined` errors, e.g. "insufficient_funds", "fraudulent". */
  declineCode?: string;
  /** Human-readable explanation Stripe returned. */
  message: string;
};

export type OffSessionChargeResult =
  | { kind: "charged"; paymentIntentId: string }
  | { kind: "requires_action"; declineReason?: DeclineReason }
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

  try {
    const pi = await stripeClient.paymentIntents.create(params);
    if (pi.status === "succeeded") {
      return { kind: "charged", paymentIntentId: pi.id };
    }
    if (pi.status !== "requires_action") {
      console.warn(`[chargeCustomerOffSession] unexpected PI status: ${pi.status}`);
    }
    return { kind: "requires_action" };
  } catch (error) {
    // Card-level failures (declined, expired, fraud, 3DS required, …) and
    // Stripe-rejected request shapes fall back to Checkout so the customer
    // can update their card / authenticate interactively. Capture Stripe's
    // own decline metadata so callers can surface "insufficient funds" /
    // "expired card" instead of a silent fallback.
    if (
      error instanceof Stripe.errors.StripeCardError ||
      error instanceof Stripe.errors.StripeInvalidRequestError
    ) {
      const declineCode =
        error instanceof Stripe.errors.StripeCardError ? error.decline_code : undefined;
      console.warn(
        `[chargeCustomerOffSession] off-session charge failed (${error.type}/${error.code}/${declineCode ?? "-"}), falling back to Checkout: ${error.message}`,
      );
      const declineReason: DeclineReason | undefined = error.code
        ? {
            code: error.code,
            ...(declineCode ? { declineCode } : {}),
            message: error.message,
          }
        : undefined;
      return { kind: "requires_action", declineReason };
    }
    console.error("[chargeCustomerOffSession]", error);
    throw error;
  }
}
