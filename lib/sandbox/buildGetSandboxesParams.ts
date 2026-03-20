import type { SelectAccountSandboxesParams } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

export interface BuildGetSandboxesParamsInput {
  /** The authenticated account ID */
  account_id: string;
  /** Optional target account ID to filter by */
  target_account_id?: string;
  /** Optional sandbox ID to filter by */
  sandbox_id?: string;
}

export type BuildGetSandboxesParamsResult =
  | { params: SelectAccountSandboxesParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for selectAccountSandboxes based on auth context.
 *
 * Returns accountIds with the key owner's account.
 * If target_account_id is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for selectAccountSandboxes or an error
 */
export async function buildGetSandboxesParams(
  input: BuildGetSandboxesParamsInput,
): Promise<BuildGetSandboxesParamsResult> {
  const { account_id, target_account_id, sandbox_id } = input;

  // Handle account_id filter if provided
  if (target_account_id) {
    const hasAccess = await canAccessAccount({
      targetAccountId: target_account_id,
      currentAccountId: account_id,
    });
    if (!hasAccess) {
      return {
        params: null,
        error: "Access denied to specified account_id",
      };
    }
    return { params: { accountIds: [target_account_id], sandboxId: sandbox_id }, error: null };
  }

  // Return the key owner's account
  return { params: { accountIds: [account_id], sandboxId: sandbox_id }, error: null };
}
