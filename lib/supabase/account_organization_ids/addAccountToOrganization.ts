import supabase from "../serverClient";

/**
 * Add an account to an organization.
 * Used when creating organizations or auto-assigning based on email domain.
 *
 * @param accountId - The account ID to add
 * @param organizationId - The organization ID to add them to
 * @returns The created record ID, or null if failed
 */
export async function addAccountToOrganization(
  accountId: string,
  organizationId: string,
): Promise<string | null> {
  if (!accountId || !organizationId) return null;

  const { data, error } = await supabase
    .from("account_organization_ids")
    .insert({
      account_id: accountId,
      organization_id: organizationId,
    })
    .select("id")
    .single();

  if (error) return null;

  return data?.id || null;
}
