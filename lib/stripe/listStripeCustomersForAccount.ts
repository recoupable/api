import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

const PAGE_LIMIT = 10;

/**
 * Every Stripe Customer tagged with `metadata.accountId`. An account can be
 * tagged on more than one Customer (an org whose invoiced plan lives on one
 * Customer and whose card was saved on another), so billing reads must see
 * all of them; `pickPrimaryStripeCustomer` chooses the one to charge.
 *
 * @param accountId Must be a validated UUID: it is interpolated into a Stripe
 *   customer-search query string, so callers validate before invoking.
 */
export async function listStripeCustomersForAccount(accountId: string): Promise<Stripe.Customer[]> {
  const search = await stripeClient.customers.search({
    query: `metadata['accountId']:'${accountId}'`,
    limit: PAGE_LIMIT,
  });
  return search.data;
}
