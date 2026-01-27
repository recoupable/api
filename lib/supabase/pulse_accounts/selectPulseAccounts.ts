import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

export interface SelectPulseAccountsParams {
  /** Account IDs to filter by. If undefined, returns all records. */
  accountIds?: string[];
  /** Optional filter by active status */
  active?: boolean;
}

/**
 * Retrieves pulse account records.
 * If accountIds is provided, filters by those IDs.
 * If accountIds is undefined, returns all records.
 *
 * @param params - The parameters for the query
 * @param params.accountIds - Optional array of account IDs to filter by. If undefined, returns all.
 * @param params.active - Optional filter by active status (true/false). If undefined, returns all.
 * @returns Array of pulse account records
 */
export async function selectPulseAccounts(
  params: SelectPulseAccountsParams = {},
): Promise<Tables<"pulse_accounts">[]> {
  const { accountIds, active } = params;

  // If accountIds is an empty array, return empty (no accounts to look up)
  if (accountIds !== undefined && accountIds.length === 0) {
    return [];
  }

  let query = supabase.from("pulse_accounts").select("*");

  // Only filter by account IDs if provided
  if (accountIds !== undefined) {
    query = query.in("account_id", accountIds);
  }

  if (active !== undefined) {
    query = query.eq("active", active);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectPulseAccounts:", error);
    return [];
  }

  return data || [];
}
