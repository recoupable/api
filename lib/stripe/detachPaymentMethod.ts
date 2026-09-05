import stripeClient from "@/lib/stripe/client";

/** Detach a payment method from its customer; Stripe drops it as the default too. */
export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await stripeClient.paymentMethods.detach(paymentMethodId);
}
