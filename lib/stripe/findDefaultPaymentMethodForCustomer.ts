import stripeClient from "@/lib/stripe/client";

/**
 * Returns the payment method ID Stripe should charge off-session for a
 * given Customer. Prefers `invoice_settings.default_payment_method`;
 * falls back to the first attached card. Returns null when the Customer
 * has no card on file or has been deleted.
 */
export async function findDefaultPaymentMethodForCustomer(
  customerId: string,
): Promise<string | null> {
  const customer = await stripeClient.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) {
    return null;
  }

  const defaultPm = (customer as { invoice_settings?: { default_payment_method?: string | null } })
    .invoice_settings?.default_payment_method;
  if (typeof defaultPm === "string" && defaultPm) {
    return defaultPm;
  }

  const list = await stripeClient.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return list.data[0]?.id ?? null;
}
