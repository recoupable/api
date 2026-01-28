import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { SelectPulseAccountsParams } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { RECOUP_ORG_ID } from "@/lib/const";

export interface BuildGetPulsesParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** The organization ID from the API key (null for personal keys) */
  orgId: string | null;
  /** Optional target account ID to filter by */
  targetAccountId?: string;
  /** Optional active status filter */
  active?: boolean;
}

export type BuildGetPulsesParamsResult =
  | { params: SelectPulseAccountsParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for selectPulseAccounts based on auth context.
 *
 * For personal keys: Returns accountIds with the key owner's account
 * For org keys: Returns orgId for filtering by org membership
 * For Recoup admin key: Returns empty params to indicate ALL records
 *
 * If targetAccountId is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for selectPulseAccounts or an error
 */
export async function buildGetPulsesParams(
  input: BuildGetPulsesParamsInput,
): Promise<BuildGetPulsesParamsResult> {
  const { accountId, orgId, targetAccountId, active } = input;

  // Handle account_id filter if provided
  if (targetAccountId) {
    const hasAccess = await canAccessAccount({ orgId, targetAccountId });
    if (!hasAccess) {
      return {
        params: null,
        error: orgId
          ? "account_id is not a member of this organization"
          : "Personal API keys cannot filter by account_id",
      };
    }
    return { params: { accountIds: [targetAccountId], active }, error: null };
  }

  // No account_id filter - determine what to return based on key type
  if (orgId === RECOUP_ORG_ID) {
    // Recoup admin: return undefined to indicate ALL records
    return { params: { active }, error: null };
  }

  if (orgId) {
    // Org key: return orgId for filtering by org membership in database
    return { params: { orgId, active }, error: null };
  }

  // Personal key: Only return the key owner's account
  return { params: { accountIds: [accountId], active }, error: null };
}
