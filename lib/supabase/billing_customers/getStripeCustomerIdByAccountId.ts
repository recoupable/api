import supabase from "@/lib/supabase/serverClient";

/**
 * Look up the Stripe customer ID for an account from the local
 * `billing_customers` mirror. Returns `null` when the account has never
 * been linked to a Stripe customer.
 */
export async function getStripeCustomerIdByAccountId(accountId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("billing_customers")
    .select("customer_id")
    .eq("account_id", accountId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    console.error("Error fetching billing_customers:", error);
    return null;
  }

  return data?.customer_id ?? null;
}
