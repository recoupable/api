import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { SelectRoomsParams } from "@/lib/supabase/rooms/selectRooms";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { RECOUP_ORG_ID } from "@/lib/const";

export interface BuildGetChatsParamsInput {
  /** The authenticated account ID */
  account_id: string;
  /** The organization ID from the API key (null for personal keys) */
  org_id: string | null;
  /** Optional target account ID to filter by */
  target_account_id?: string;
  /** Optional artist ID to filter by */
  artist_id?: string;
}

export type BuildGetChatsParamsResult =
  | { params: SelectRoomsParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for selectRooms based on auth context.
 *
 * For personal keys: Returns account_ids with the key owner's account
 * For org keys: Fetches all org member account_ids and returns them
 * For Recoup admin key: Returns empty params to indicate ALL records
 *
 * If target_account_id is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for selectRooms or an error
 */
export async function buildGetChatsParams(
  input: BuildGetChatsParamsInput,
): Promise<BuildGetChatsParamsResult> {
  const { account_id, org_id, target_account_id, artist_id } = input;

  // Handle account_id filter if provided
  if (target_account_id) {
    const hasAccess = await canAccessAccount({ orgId: org_id, targetAccountId: target_account_id });
    if (!hasAccess) {
      return {
        params: null,
        error: org_id
          ? "account_id is not a member of this organization"
          : "Personal API keys cannot filter by account_id",
      };
    }
    return { params: { account_ids: [target_account_id], artist_id }, error: null };
  }

  // No account_id filter - determine what to return based on key type
  if (org_id === RECOUP_ORG_ID) {
    // Recoup admin: return undefined to indicate ALL records
    return { params: { artist_id }, error: null };
  }

  if (org_id) {
    // Org key: fetch all member account IDs for this organization
    const orgMembers = await getAccountOrganizations({ organizationId: org_id });
    const memberAccountIds = orgMembers.map((member) => member.account_id);
    return { params: { account_ids: memberAccountIds, artist_id }, error: null };
  }

  // Personal key: Only return the key owner's account
  return { params: { account_ids: [account_id], artist_id }, error: null };
}
