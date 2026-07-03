import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Insert a domain mapping for an organization.
 *
 * @param params - The insert parameters
 * @param params.domain - The normalized email domain (e.g. "seekermusic.com")
 * @param params.organizationId - The organization's account ID
 * @returns The created row, or null on error
 */
export async function insertOrganizationDomain({
  domain,
  organizationId,
}: {
  domain: string;
  organizationId: string;
}): Promise<Tables<"organization_domains"> | null> {
  const { data, error } = await supabase
    .from("organization_domains")
    .insert({ domain, organization_id: organizationId })
    .select()
    .single();

  if (error || !data) {
    console.error("Error inserting organization_domain:", error);
    return null;
  }

  return data;
}
