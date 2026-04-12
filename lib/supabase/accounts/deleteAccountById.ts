import supabase from "../serverClient";

/**
 * Deletes an account by ID.
 *
 * Related rows are removed by the database's foreign key cascade rules.
 *
 * @param accountId - The account ID to delete
 * @returns True when the delete succeeds
 */
export async function deleteAccountById(accountId: string): Promise<boolean> {
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);

  if (error) {
    throw new Error(`Failed to delete account: ${error.message}`);
  }

  return true;
}
