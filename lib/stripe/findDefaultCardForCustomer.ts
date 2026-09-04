import stripeClient from "@/lib/stripe/client";
import { findDefaultPaymentMethodForCustomer } from "@/lib/stripe/findDefaultPaymentMethodForCustomer";

/**
 * The customer's default payment method id, but only when it is a card.
 * Bank accounts and other method types are never returned, so callers that
 * promise to act on "the card on file" cannot touch anything else.
 */
export async function findDefaultCardForCustomer(customerId: string): Promise<string | null> {
  const paymentMethodId = await findDefaultPaymentMethodForCustomer(customerId);
  if (!paymentMethodId) return null;

  const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
  return paymentMethod.type === "card" ? paymentMethod.id : null;
}
