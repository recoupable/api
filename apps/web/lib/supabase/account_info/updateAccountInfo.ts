import supabase from "../serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates an account_info record.
 *
 * @param accountId - The account ID
 * @param updates - Partial account_info data to update
 * @returns The updated account_info record, or null if failed
 */
export async function updateAccountInfo(
  accountId: string,
  updates: TablesUpdate<"account_info">,
): Promise<Tables<"account_info"> | null> {
  const { data, error } = await supabase
    .from("account_info")
    .update(updates)
    .eq("account_id", accountId)
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] updateAccountInfo:", error);
    return null;
  }

  return data || null;
}
