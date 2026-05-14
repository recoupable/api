import stripeClient from "@/lib/stripe/client";

/**
 * Read-only counterpart to `resolveStripeCustomerForAccount`. Searches for an
 * existing Stripe Customer by `metadata.accountId` and returns its id — or
 * null when none exists yet.
 *
 * Use this from GET endpoints (`/payment-method`, etc.) so a read never has
 * the side-effect of creating a Customer row in Stripe. Mutating callers
 * (off-session charge, Checkout-session creation) should keep using
 * `resolveStripeCustomerForAccount` which provisions on miss.
 *
 * @param accountId Must be a validated UUID. The value is interpolated into a
 *   Stripe customer-search query string, so callers MUST validate input before
 *   invoking — every route consumer goes through `validateGetPaymentMethodParams`
 *   (or its equivalent zod schema) for this reason.
 */
export async function findStripeCustomerForAccount(accountId: string): Promise<string | null> {
  const search = await stripeClient.customers.search({
    query: `metadata['accountId']:'${accountId}'`,
    limit: 1,
  });
  return search.data[0]?.id ?? null;
}
