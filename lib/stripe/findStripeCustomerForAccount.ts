import { listStripeCustomersForAccount } from "@/lib/stripe/listStripeCustomersForAccount";
import { pickPrimaryStripeCustomer } from "@/lib/stripe/pickPrimaryStripeCustomer";

/**
 * Read-only counterpart to `resolveStripeCustomerForAccount`. Returns the id
 * of the account's primary Stripe Customer — the tagged Customer holding a
 * default card, else the newest tagged one — or null when none exists yet.
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
  const customers = await listStripeCustomersForAccount(accountId);
  return pickPrimaryStripeCustomer(customers)?.id ?? null;
}
