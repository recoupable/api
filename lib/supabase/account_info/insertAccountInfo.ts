import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a new account_info record.
 *
 * @param info - The account info data to insert
 * @returns The inserted account_info record, or null if failed
 */
export async function insertAccountInfo(
  info: TablesInsert<"account_info">,
): Promise<Tables<"account_info"> | null> {
  const { data, error } = await supabase.from("account_info").insert(info).select("*").single();

  if (error) {
    console.error("[ERROR] insertAccountInfo:", error);
    return null;
  }

  return data || null;
}
