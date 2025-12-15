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
  accountId: string;
  organizationId?: string;
}

/**
 * Get all organizations an account belongs to.
 *
 * @param params - The parameters for the query
 * @param params.accountId - The account ID to get organizations for
 * @param params.organizationId - Optional organization ID to filter by
 * @returns Array of organizations with their account info
 */
export async function getAccountOrganizations(
  params: GetAccountOrganizationsParams,
): Promise<AccountOrganization[]> {
  const { accountId, organizationId } = params;

  if (!accountId) return [];

  let query = supabase
    .from("account_organization_ids")
    .select(
      `
      *,
      organization:accounts!account_organization_ids_organization_id_fkey (
        *,
        account_info ( * )
      )
    `,
    )
    .eq("account_id", accountId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) return [];

  return (data as AccountOrganization[]) || [];
}
