import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select all domain mappings for an organization.
 *
 * @param organizationId - The organization's account ID
 * @returns The domain mapping rows, or null on error
 */
export async function selectOrganizationDomains(
  organizationId: string,
): Promise<Tables<"organization_domains">[] | null> {
  const { data, error } = await supabase
    .from("organization_domains")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching organization_domains:", error);
    return null;
  }

  return data || [];
}
