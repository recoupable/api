import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Hard ceiling on grants returned for one account. Grants are made by hand and
 * are rare — an account with 500 of them is a bug worth noticing, not a page
 * worth turning. Matches the cap documented on the `grants` array.
 */
const MAX_CREDIT_GRANTS = 500;

interface SelectCreditGrantsParams {
  accountId: string;
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
}

/**
 * Selects an account's admin credit grants, newest first.
 *
 * @param params - Account filter and optional period cutoff.
 * @returns Matching credit_grants rows, capped at 500.
 */
export async function selectCreditGrants(
  params: SelectCreditGrantsParams,
): Promise<Tables<"credit_grants">[]> {
  let query = supabase
    .from("credit_grants")
    .select("*")
    .eq("account_id", params.accountId)
    .order("created_at", { ascending: false })
    // Deterministic tiebreaker for grants written in the same instant —
    // without it the 500-row cap could return a different set each call.
    // Matches selectUsageEvents.
    .order("id", { ascending: false });

  if (params.createdAfter) query = query.gte("created_at", params.createdAfter);

  const { data, error } = await query.limit(MAX_CREDIT_GRANTS);

  if (error) {
    console.error("Error selecting credit_grants:", error);
    throw error;
  }

  return data ?? [];
}
