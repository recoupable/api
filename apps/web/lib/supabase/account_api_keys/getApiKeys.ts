import type { Tables } from "@/types/database.types";
import supabase from "../serverClient";

export interface GetApiKeysParams {
  id?: string;
  accountId?: string;
}

/**
 * Gets API keys matching the provided criteria.
 * Can filter by key ID or account ID (or both).
 *
 * @param params - Object containing optional id and/or accountId
 * @returns The API keys matching the criteria, or null if error
 */
export async function getApiKeys(
  params: GetApiKeysParams = {},
): Promise<{ data: Tables<"account_api_keys">[] | null; error: unknown }> {
  const { id, accountId } = params;

  let query = supabase.from("account_api_keys").select("*");

  if (id) {
    query = query.eq("id", id);
  }

  if (accountId) {
    query = query.eq("account", accountId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return { data: null, error };

  return { data, error: null };
}
