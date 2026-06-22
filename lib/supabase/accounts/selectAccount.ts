import supabase from "../serverClient";

/**
 * Select an account by ID with its account_socials.
 *
 * @param accountId - The account ID to look up
 * @returns The account with account_socials, or null if not found
 */
export async function selectAccount(accountId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*, account_socials(*)")
    .eq("id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
