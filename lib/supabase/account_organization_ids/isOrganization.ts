import supabase from "../serverClient";

/**
 * Checks if an accountId is an organization.
 *
 * An account is considered an organization if it appears as the organization_id
 * in the account_organization_ids table.
 *
 * @param accountId - The account ID to check
 * @returns true if the account is an organization, false otherwise
 */
export async function isOrganization(accountId: string): Promise<boolean> {
  if (!accountId) {
    return false;
  }

  const { data, error } = await supabase
    .from("account_organization_ids")
    .select("organization_id")
    .eq("organization_id", accountId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return data !== null;
}
