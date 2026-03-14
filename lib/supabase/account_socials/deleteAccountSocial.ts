import supabase from "../serverClient";

/**
 * Deletes an account_social record by account ID and social ID.
 *
 * @param accountId - The account ID
 * @param socialId - The social ID
 * @returns True if successful, false otherwise
 */
export async function deleteAccountSocial(accountId: string, socialId: string): Promise<boolean> {
  const { error } = await supabase
    .from("account_socials")
    .delete()
    .eq("account_id", accountId)
    .eq("social_id", socialId);

  if (error) {
    console.error("[ERROR] deleteAccountSocial:", error);
    return false;
  }

  return true;
}
