import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves accounts by ID.
 *
 * @param accountId - The account ID
 * @returns Array of account records (empty array if not found)
 */
export async function selectAccounts(accountId: string): Promise<Tables<"accounts">[]> {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId);

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Retrieves multiple accounts by an array of IDs.
 *
 * @param accountIds - Array of account IDs to fetch
 * @returns Array of account records (empty array on error or no results)
 */
export async function selectAccountsByIds(
  accountIds: string[],
): Promise<Pick<Tables<"accounts">, "id" | "name">[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name")
    .in("id", accountIds);

  if (error || !data) {
    console.error("Error fetching accounts by IDs:", error);
    return [];
  }

  return data;
}
