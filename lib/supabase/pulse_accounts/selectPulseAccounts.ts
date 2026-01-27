import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

export interface SelectPulseAccountsParams {
  /** Account IDs to filter by. If undefined, returns all records. */
  accountIds?: string[];
  /** Organization ID to filter by membership. Uses inner join with account_organization_ids. */
  orgId?: string;
  /** Optional filter by active status */
  active?: boolean;
}

/**
 * Retrieves pulse account records.
 * - If accountIds is provided, filters by those IDs.
 * - If orgId is provided, filters by organization membership (inner join).
 * - If neither is provided, returns all records.
 *
 * @param params - The parameters for the query
 * @param params.accountIds - Optional array of account IDs to filter by.
 * @param params.orgId - Optional organization ID to filter by membership.
 * @param params.active - Optional filter by active status (true/false). If undefined, returns all.
 * @returns Array of pulse account records
 */
export async function selectPulseAccounts(
  params: SelectPulseAccountsParams = {},
): Promise<Tables<"pulse_accounts">[]> {
  const { accountIds, orgId, active } = params;

  // If accountIds is an empty array, return empty (no accounts to look up)
  if (accountIds !== undefined && accountIds.length === 0) {
    return [];
  }

  // Use different select based on whether we need org join
  // Join path: pulse_accounts -> accounts -> account_organization_ids
  // Must specify FK name because accounts has two relationships to account_organization_ids
  const selectColumns = orgId
    ? "*, accounts!inner(account_organization_ids!account_organization_ids_account_id_fkey!inner(organization_id))"
    : "*";

  let query = supabase.from("pulse_accounts").select(selectColumns);

  // Filter by org membership if orgId provided
  if (orgId) {
    query = query.eq("accounts.account_organization_ids.organization_id", orgId);
  }

  // Filter by account IDs if provided
  if (accountIds !== undefined) {
    query = query.in("account_id", accountIds);
  }

  if (active !== undefined) {
    query = query.eq("active", active);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectPulseAccounts:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Strip joined data if present (from org join through accounts)
  if (orgId) {
    return (data as unknown as (Tables<"pulse_accounts"> & { accounts?: unknown })[]).map(
      ({ accounts: _, ...pulseAccount }) => pulseAccount,
    );
  }

  return data as unknown as Tables<"pulse_accounts">[];
}
