import supabase from "@/lib/supabase/serverClient";
import type { Database, Tables } from "@/types/database.types";

type BillingProvider = Database["public"]["Enums"]["billing_provider"];

/**
 * Select rows from `billing_customers`, optionally filtered by account and provider.
 */
export async function selectBillingCustomers({
  accountId,
  provider,
}: {
  accountId?: string;
  provider?: BillingProvider;
} = {}): Promise<Tables<"billing_customers">[]> {
  let query = supabase.from("billing_customers").select("*");

  if (accountId) query = query.eq("account_id", accountId);
  if (provider) query = query.eq("provider", provider);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}
