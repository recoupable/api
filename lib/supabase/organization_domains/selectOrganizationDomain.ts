import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select a domain mapping row by domain.
 * A domain can be mapped to at most one organization.
 *
 * @param domain - The normalized email domain (e.g. "seekermusic.com")
 * @returns The domain mapping row if found, null if no row exists
 * @throws If the query fails, so callers never mistake a transient
 *   Supabase error for "domain not mapped"
 */
export async function selectOrganizationDomain(
  domain: string,
): Promise<Tables<"organization_domains"> | null> {
  const { data, error } = await supabase
    .from("organization_domains")
    .select("*")
    .eq("domain", domain)
    .maybeSingle();

  if (error) {
    console.error("Error fetching organization_domain:", error);
    throw new Error(`Failed to fetch organization_domain: ${error.message}`);
  }

  return data;
}
