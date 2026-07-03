import supabase from "../serverClient";

/**
 * Delete a domain mapping from an organization.
 * Idempotent - deleting a mapping that does not exist succeeds.
 *
 * @param params - The delete parameters
 * @param params.domain - The normalized email domain (e.g. "seekermusic.com")
 * @param params.organizationId - The organization's account ID
 * @returns true on success, false on error
 */
export async function deleteOrganizationDomain({
  domain,
  organizationId,
}: {
  domain: string;
  organizationId: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("organization_domains")
    .delete()
    .eq("organization_id", organizationId)
    .eq("domain", domain);

  if (error) {
    console.error("Error deleting organization_domain:", error);
    return false;
  }

  return true;
}
