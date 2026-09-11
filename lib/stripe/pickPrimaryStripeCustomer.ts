import type Stripe from "stripe";

const holdsCard = (customer: Stripe.Customer): boolean =>
  Boolean(customer.invoice_settings?.default_payment_method);

/**
 * The Customer to charge, open the portal on, or save a card to when an
 * account is tagged on several: the one holding a default payment method,
 * newest first; otherwise the newest Customer. Null when the list is empty.
 */
export function pickPrimaryStripeCustomer(customers: Stripe.Customer[]): Stripe.Customer | null {
  if (customers.length === 0) return null;
  const byNewest = [...customers].sort((a, b) => b.created - a.created);
  return byNewest.find(holdsCard) ?? byNewest[0];
}
