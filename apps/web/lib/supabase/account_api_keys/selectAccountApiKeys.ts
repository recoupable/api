import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select account_api_keys rows with optional filters.
 *
 * Currently supports filtering by key_hash.
 *
 * @param params - Query parameters
 * @param params.keyHash - Optional API key hash to filter by
 * @returns Array of account_api_keys rows
 */
export async function selectAccountApiKeys({
  keyHash,
}: {
  keyHash?: string;
} = {}): Promise<Tables<"account_api_keys">[] | null> {
  let query = supabase.from("account_api_keys").select("*");

  if (keyHash) {
    query = query.eq("key_hash", keyHash);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching account_api_keys:", error);
    return null;
  }

  return data || [];
}
