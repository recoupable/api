import type Stripe from "stripe";

export type AccountIdResolution = { accountId: string; source: "subscription" | "email" } | null;

type AccountByEmail = (email: string) => Promise<{ account_id: string } | null>;

type Params = {
  customer: Stripe.Customer;
  subMap: Map<string, string>;
  accountByEmail: AccountByEmail;
};

/**
 * Resolve a Stripe Customer to a Recoup accountId for backfill stamping.
 * Authoritative path (subscription metadata) wins over the heuristic path
 * (email match) when both are available.
 */
export async function resolveAccountIdForCustomer({
  customer,
  subMap,
  accountByEmail,
}: Params): Promise<AccountIdResolution> {
  const fromSub = subMap.get(customer.id);
  if (fromSub) {
    return { accountId: fromSub, source: "subscription" };
  }

  if (customer.email) {
    const normalized = customer.email.trim().toLowerCase();
    if (normalized) {
      const account = await accountByEmail(normalized);
      if (account?.account_id) {
        return { accountId: account.account_id, source: "email" };
      }
    }
  }

  return null;
}
