import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves account_info by account_id.
 *
 * @param accountId - The account ID
 * @returns The account_info record, or null if not found
 */
export async function selectAccountInfo(accountId: string): Promise<Tables<"account_info"> | null> {
  const { data, error } = await supabase
    .from("account_info")
    .select("*")
    .eq("account_id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
