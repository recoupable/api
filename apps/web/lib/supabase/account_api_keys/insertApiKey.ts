import supabase from "../serverClient";
import type { Database } from "@/types/database.types";

/**
 * Inserts an API key into the database
 *
 * @param input - The input object containing the name, account, and key_hash
 * @param input.name - The input object containing the name, account, and key_hash
 * @param input.account - The account ID
 * @param input.key_hash - The hash of the API key
 * @returns The inserted API key
 */
export async function insertApiKey({
  name,
  account,
  key_hash,
}: Database["public"]["Tables"]["account_api_keys"]["Insert"]) {
  const { data, error } = await supabase
    .from("account_api_keys")
    .insert({
      name,
      account,
      key_hash,
    })
    .select()
    .single();

  if (error) return { data: null, error };

  return { data, error: null };
}
