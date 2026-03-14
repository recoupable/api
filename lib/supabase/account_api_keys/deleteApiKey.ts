import supabase from "../serverClient";

/**
 * Deletes an API key by its ID
 *
 * @param keyId - The ID of the API key to delete
 * @returns The result of the delete operation
 */
export async function deleteApiKey(keyId: string) {
  const { error } = await supabase.from("account_api_keys").delete().eq("id", keyId);

  if (error) return { error };

  return { error: null };
}
