import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

export interface SelectAllPulseAccountsParams {
  /** Optional filter by active status */
  active?: boolean;
}

/**
 * Retrieves all pulse account records.
 * This should only be used by the Recoup admin API key.
 *
 * @param params - The parameters for the query
 * @param params.active - Optional filter by active status (true/false). If undefined, returns all.
 * @returns Array of all pulse account records
 */
export async function selectAllPulseAccounts(
  params: SelectAllPulseAccountsParams = {},
): Promise<Tables<"pulse_accounts">[]> {
  const { active } = params;

  let query = supabase.from("pulse_accounts").select("*");

  if (active !== undefined) {
    query = query.eq("active", active);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectAllPulseAccounts:", error);
    return [];
  }

  return data || [];
}
