import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Returns the Stripe billing_customers row for an account, if one exists.
 */
export async function selectStripeBillingCustomerByAccountId(
  accountId: string,
): Promise<Tables<"billing_customers"> | null> {
  const { data, error } = await supabase
    .from("billing_customers")
    .select("*")
    .eq("account_id", accountId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    console.error("selectStripeBillingCustomerByAccountId:", error);
    return null;
  }

  return data ?? null;
}
