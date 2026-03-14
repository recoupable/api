import supabase from "../serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates an account record.
 *
 * @param accountId - The account ID
 * @param updates - Partial account data to update
 * @returns The updated account record, or null if failed
 */
export async function updateAccount(
  accountId: string,
  updates: TablesUpdate<"accounts">,
): Promise<Tables<"accounts"> | null> {
  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] updateAccount:", error);
    return null;
  }

  return data || null;
}
