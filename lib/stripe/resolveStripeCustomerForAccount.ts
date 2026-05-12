import stripeClient from "@/lib/stripe/client";

/**
 * Finds the Stripe Customer for an account or creates one.
 *
 * Looks up by `metadata.accountId` via Stripe Customer Search; if no match,
 * creates a new Customer with `metadata.accountId` stamped so subsequent
 * lookups for the same account succeed.
 *
 * Note: Stripe's search index is eventually consistent (~60s lag after
 * Customer creation). Two concurrent calls for a brand-new accountId may
 * both miss the search and create duplicate Customers. Acceptable for
 * top-up cadence — concurrent first-top-ups for the same account are
 * exceedingly rare.
 */
export async function resolveStripeCustomerForAccount(accountId: string): Promise<string> {
  const search = await stripeClient.customers.search({
    query: `metadata['accountId']:'${accountId}'`,
    limit: 1,
  });

  const existing = search.data[0];
  if (existing) {
    return existing.id;
  }

  const created = await stripeClient.customers.create({
    metadata: { accountId },
  });
  return created.id;
}
