import supabase from "../serverClient";

/**
 * Select account_organization_ids rows matching an account and a set of organization IDs.
 *
 * @param accountId - The account ID
 * @param orgIds - Organization IDs to check membership against
 * @returns Array of matching rows, or null on error
 */
export async function selectAccountOrganizationIds(
  accountId: string,
  orgIds: string[],
) {
  if (!orgIds.length) return [];

  const { data, error } = await supabase
    .from("account_organization_ids")
    .select("organization_id")
    .eq("account_id", accountId)
    .in("organization_id", orgIds)
    .limit(1);

  if (error) {
    return null;
  }

  return data || [];
}
