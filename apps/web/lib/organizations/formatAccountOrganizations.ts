import type { Database } from "@/types/database.types";
import type { AccountOrganization } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

// Use Supabase schema types directly (DRY principle)
type AccountOrgIdsRow = Database["public"]["Tables"]["account_organization_ids"]["Row"];
type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInfoRow = Database["public"]["Tables"]["account_info"]["Row"];

// FormattedOrganization composes fields from multiple tables
export interface FormattedOrganization {
  id: AccountOrgIdsRow["id"];
  organization_id: AccountOrgIdsRow["organization_id"];
  organization_name: AccountRow["name"];
  organization_image: AccountInfoRow["image"];
}

/**
 * Formats raw account organizations into a flat structure for the frontend.
 * Deduplicates by organization_id.
 *
 * @param rawOrgs - Raw organization data from the database
 * @returns Formatted and deduplicated organizations
 */
export function formatAccountOrganizations(
  rawOrgs: AccountOrganization[],
): FormattedOrganization[] {
  const seen = new Set<string>();

  return rawOrgs
    .filter(org => {
      if (!org.organization_id || seen.has(org.organization_id)) return false;
      seen.add(org.organization_id);
      return true;
    })
    .map(org => ({
      id: org.id,
      organization_id: org.organization_id,
      organization_name: org.organization?.name || null,
      organization_image: org.organization?.account_info?.[0]?.image || null,
    }));
}
