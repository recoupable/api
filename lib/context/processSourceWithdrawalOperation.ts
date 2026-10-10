import type { SourceWithdrawalOperation } from "./sourceWithdrawalSchemas";
import type { ContextSourceWithdrawalReceipt } from "./sourceWithdrawalTypes";

/** Withdraw one recorded source input after shared actor/workspace authorization; no deletion or recompute. */
export async function processSourceWithdrawalOperation(
  accountId: string,
  ownerId: string,
  args: SourceWithdrawalOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  return (await rpc("withdraw_context_request_source", {
    p_actor: accountId,
    p_owner: ownerId,
    p_request: args.request_id,
    p_source: args.source_id ?? null,
    p_source_version: args.source_version_id ?? null,
  })) as ContextSourceWithdrawalReceipt;
}
