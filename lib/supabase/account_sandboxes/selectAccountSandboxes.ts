import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

export interface SelectAccountSandboxesParams {
  accountIds?: string[];
  orgId?: string | null;
  sandboxId?: string;
}

/**
 * Selects account sandbox records from the database.
 *
 * @param params - Query parameters
 * @param params.accountIds - Filter by specific account IDs
 * @param params.orgId - Filter by organization membership
 * @param params.sandboxId - Filter by specific sandbox ID
 * @returns Array of account sandbox records
 */
export async function selectAccountSandboxes({
  accountIds,
  orgId,
  sandboxId,
}: SelectAccountSandboxesParams): Promise<Tables<"account_sandboxes">[]> {
  let query = supabase.from("account_sandboxes").select("*");

  if (sandboxId) {
    query = query.eq("sandbox_id", sandboxId);
  }

  if (accountIds && accountIds.length > 0) {
    query = query.in("account_id", accountIds);
  } else if (orgId) {
    // Get accounts in the organization
    const { data: orgAccounts } = await supabase
      .from("account_organization_ids")
      .select("account_id")
      .eq("organization_id", orgId);

    if (orgAccounts && orgAccounts.length > 0) {
      const orgAccountIds = orgAccounts.map(a => a.account_id);
      query = query.in("account_id", orgAccountIds);
    } else {
      // No accounts in org, return empty
      return [];
    }
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching account sandboxes:", error);
    return [];
  }

  return data || [];
}
