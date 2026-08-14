import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Reads whether the Stripe Customer has opted out of automatic top-up.
 *
 * The flag is the presence of the `auto_recharge_opt_out` metadata key —
 * any non-empty value means opted out; the value is never parsed. Opting
 * back in deletes the key (see `setAutoRechargeOptOut`).
 *
 * Always a fresh `customers.retrieve`: Stripe's customer-search index is
 * eventually consistent (~60s), so a charge path reading a search-result
 * copy could bill a customer who just opted out. Retrieval by id is
 * strongly consistent.
 */
export async function getAutoRechargeOptOut(customerId: string): Promise<boolean> {
  const customer = (await stripeClient.customers.retrieve(customerId)) as
    | Stripe.Customer
    | Stripe.DeletedCustomer;
  if (customer.deleted) return false;
  return Boolean((customer as Stripe.Customer).metadata?.auto_recharge_opt_out);
}
