import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * One page of a single Stripe customer's invoices, newest first (Stripe's
 * default order), optionally restricted to invoices created before a
 * Unix timestamp so pages can be merged across customers.
 */
export async function listCustomerInvoicesBefore(args: {
  customerId: string;
  limit: number;
  createdBefore?: number;
}): Promise<Stripe.ApiList<Stripe.Invoice>> {
  const { customerId, limit, createdBefore } = args;
  return stripeClient.invoices.list({
    customer: customerId,
    limit,
    ...(createdBefore !== undefined ? { created: { lt: createdBefore } } : {}),
  });
}
