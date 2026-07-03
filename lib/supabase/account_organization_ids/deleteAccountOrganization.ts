import supabase from "../serverClient";

/**
 * Delete an account's membership row(s) in an organization.
 * Deleting a non-existent membership succeeds (idempotent).
 *
 * @param accountId - The member's account ID
 * @param organizationId - The organization's account ID
 * @returns true on success (including no-op), false on error
 */
export async function deleteAccountOrganization(
  accountId: string,
  organizationId: string,
): Promise<boolean> {
  if (!accountId || !organizationId) return false;

  const { error } = await supabase
    .from("account_organization_ids")
    .delete()
    .eq("account_id", accountId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[ERROR] deleteAccountOrganization:", error);
    return false;
  }

  return true;
}
