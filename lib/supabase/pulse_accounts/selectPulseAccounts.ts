import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

export interface SelectPulseAccountsParams {
  /** Account IDs to filter by */
  accountIds: string[];
  /** Optional filter by active status */
  active?: boolean;
}

/**
 * Retrieves multiple pulse account records by account IDs.
 *
 * @param params - The parameters for the query
 * @param params.accountIds - Array of account IDs to look up
 * @param params.active - Optional filter by active status (true/false). If undefined, returns all.
 * @returns Array of pulse account records
 */
export async function selectPulseAccounts(
  params: SelectPulseAccountsParams,
): Promise<Tables<"pulse_accounts">[]> {
  const { accountIds, active } = params;

  if (accountIds.length === 0) {
    return [];
  }

  let query = supabase.from("pulse_accounts").select("*").in("account_id", accountIds);

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
