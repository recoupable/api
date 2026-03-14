import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves accounts by one or more IDs.
 *
 * Accepts either a single account ID string or an array of account IDs.
 * Returns all matching account records.
 *
 * @param accountId - A single account ID string, or an array of account IDs
 * @returns Array of account records (empty array if not found or on error)
 */
export async function selectAccounts(accountId: string | string[]): Promise<Tables<"accounts">[]> {
  const ids = Array.isArray(accountId) ? accountId : [accountId];

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("accounts").select("*").in("id", ids);

  if (error) {
    throw error;
  }

  return data ?? [];
}
