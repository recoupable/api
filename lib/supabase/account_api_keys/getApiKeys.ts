import supabase from "../serverClient";

/**
 * Gets all API keys for an account
 *
 * @param accountId - The ID of the account to get the API keys for
 * @returns The API keys for the account
 */
export async function getApiKeys(accountId: string) {
  const { data, error } = await supabase
    .from("account_api_keys")
    .select("id, name, created_at")
    .eq("account", accountId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error };

  return { data, error: null };
}
