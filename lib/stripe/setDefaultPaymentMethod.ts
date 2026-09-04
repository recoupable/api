import stripeClient from "@/lib/stripe/client";

/** Make a payment method the customer's invoice default (what off-session charges use). */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  await stripeClient.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}
