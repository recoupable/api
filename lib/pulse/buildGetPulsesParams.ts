import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { SelectPulseAccountsParams } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";

export interface BuildGetPulsesParamsInput {
  /** The authenticated account ID */
  accountId: string;
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
 * Returns accountIds with the key owner's account.
 * If targetAccountId is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for selectPulseAccounts or an error
 */
export async function buildGetPulsesParams(
  input: BuildGetPulsesParamsInput,
): Promise<BuildGetPulsesParamsResult> {
  const { accountId, targetAccountId, active } = input;

  // Handle account_id filter if provided
  if (targetAccountId) {
    const hasAccess = await canAccessAccount({
      targetAccountId,
      currentAccountId: accountId,
    });
    if (!hasAccess) {
      return {
        params: null,
        error: "Access denied to specified account_id",
      };
    }
    return { params: { accountIds: [targetAccountId], active }, error: null };
  }

  // Return the key owner's account
  return { params: { accountIds: [accountId], active }, error: null };
}
