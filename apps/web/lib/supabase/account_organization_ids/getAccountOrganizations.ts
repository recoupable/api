import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/** Row type with joined organization account and its info */
export type AccountOrganization = Tables<"account_organization_ids"> & {
  organization:
    | (Tables<"accounts"> & {
        account_info: Tables<"account_info">[] | null;
      })
    | null;
};

export interface GetAccountOrganizationsParams {
  accountId?: string;
  organizationId?: string;
}

/**
 * Get account organization relationships.
 *
 * Can query by:
 * - accountId only: Get all organizations an account belongs to
 * - organizationId only: Get all members of an organization
 * - both: Check if a specific account belongs to a specific organization
 *
 * @param params - The parameters for the query
 * @param params.accountId - Optional account ID to filter by
 * @param params.organizationId - Optional organization ID to filter by
 * @returns Array of organizations with their account info
 */
export async function getAccountOrganizations(
  params: GetAccountOrganizationsParams,
): Promise<AccountOrganization[]> {
  const { accountId, organizationId } = params;

  if (!accountId && !organizationId) return [];

  let query = supabase.from("account_organization_ids").select(
    `
      *,
      organization:accounts!account_organization_ids_organization_id_fkey (
        *,
        account_info ( * )
      )
    `,
  );

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) return [];

  return (data as AccountOrganization[]) || [];
}
