import stripeClient from "@/lib/stripe/client";
import { listStripeCustomersForAccount } from "@/lib/stripe/listStripeCustomersForAccount";
import { pickPrimaryStripeCustomer } from "@/lib/stripe/pickPrimaryStripeCustomer";

/**
 * Finds the Stripe Customer for an account or creates one.
 *
 * Looks up every Customer tagged `metadata.accountId` and returns the primary
 * one (the Customer holding a default card, else the newest); if no match,
 * creates a new Customer with `metadata.accountId` stamped so subsequent
 * lookups for the same account succeed.
 *
 * Stripe's search index is eventually consistent (~60s lag after Customer
 * creation), so two back-to-back calls for a brand-new accountId can both
 * miss the search. The Customer-create call uses a deterministic Stripe
 * idempotency key derived from accountId so Stripe dedupes those races
 * within its 24-hour idempotency window.
 */
export async function resolveStripeCustomerForAccount(accountId: string): Promise<string> {
  const existing = pickPrimaryStripeCustomer(await listStripeCustomersForAccount(accountId));
  if (existing) {
    return existing.id;
  }

  const created = await stripeClient.customers.create(
    { metadata: { accountId } },
    { idempotencyKey: accountId },
  );
  return created.id;
}
