import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select subscription rows, optionally filtered by account IDs and/or active
 * state. The `subscriptions` table is the local mirror of cross-provider
 * billing state (stripe, lemon-squeezy, paddle).
 */
export default async function selectSubscriptions({
  accountIds,
  active,
}: {
  accountIds?: string | string[];
  active?: boolean;
} = {}): Promise<Tables<"subscriptions">[]> {
  let query = supabase.from("subscriptions").select("*");

  if (accountIds !== undefined) {
    const ids = Array.isArray(accountIds) ? accountIds : [accountIds];
    query = query.in("account_id", ids);
  }

  if (active !== undefined) {
    query = query.eq("active", active);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching subscriptions:", error);
    return [];
  }

  return data || [];
}
