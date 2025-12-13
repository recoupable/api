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
