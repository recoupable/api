import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a new account into the accounts table
 *
 * @param account - The account to insert
 * @returns The inserted account
 * @throws Error if the insert fails
 */
export async function insertAccount(
  account: TablesInsert<"accounts">,
): Promise<Tables<"accounts">> {
  const { data, error } = await supabase.from("accounts").insert(account).select().single();

  if (error) {
    throw new Error(`Failed to insert account: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to insert account: No data returned");
  }

  return data;
}
