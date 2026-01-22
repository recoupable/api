import supabase from "../serverClient";

/**
 * Looks up an organization ID by email domain.
 *
 * @param domain - The email domain to look up (e.g., "company.com")
 * @returns The organization ID if found, null otherwise
 */
export async function selectOrgByDomain(domain: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("organization_domains")
    .select("organization_id")
    .eq("domain", domain)
    .single();

  if (error || !data) {
    return null;
  }

  return data.organization_id;
}
