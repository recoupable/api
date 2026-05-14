import stripeClient from "@/lib/stripe/client";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

export type SavedCard = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  funding: string;
};

/**
 * Resolves the default payment method on file for a Stripe Customer and
 * shapes its card details for the public API. Returns null when there's no
 * PM on file, when the default PM isn't a card (e.g. bank account), or when
 * the card object is missing — callers downstream render `card: null` in
 * those cases so the top-up dialog knows to route to Checkout instead.
 */
export async function getDefaultPaymentMethodDetails(
  customerId: string,
): Promise<SavedCard | null> {
  const paymentMethodId = await findDefaultPaymentMethodForCustomer(customerId);
  if (!paymentMethodId) return null;

  const pm = await stripeClient.paymentMethods.retrieve(paymentMethodId);
  if (pm.type !== "card" || !pm.card) return null;

  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    exp_month: pm.card.exp_month,
    exp_year: pm.card.exp_year,
    funding: pm.card.funding,
  };
}
