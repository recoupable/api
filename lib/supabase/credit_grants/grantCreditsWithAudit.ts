import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface GrantCreditsWithAuditParams {
  /** The account whose balance is being set. Caller must have confirmed it exists. */
  accountId: string;
  /** The admin account making the grant, resolved from credentials — never from a body. */
  grantedBy: string;
  /** Why the grant was made. Non-empty after trimming. */
  reason: string;
  /** Balance to leave the account holding. Absolute, not a delta. */
  remainingCredits: number;
}

/**
 * Sets an account's credit balance and records the grant, atomically, via the
 * `grant_credits_with_audit` Postgres function (recoupable/database#55).
 *
 * Both writes run inside one transaction, so a balance can never move without
 * the grant that explains it — the same guarantee `deductCreditsWithAudit`
 * gives on the debit side, and the entire point of the endpoint above it.
 * `previous_credits` is captured inside the function, so it cannot be stale by
 * the time the balance moves.
 *
 * Unlike the debit path, errors are thrown rather than swallowed: a grant is a
 * deliberate staff action whose whole value is the record it leaves, so a
 * silent failure would be worse than a loud one.
 *
 * @param params - The grant to apply.
 * @returns The recorded credit_grants row.
 */
export async function grantCreditsWithAudit(
  params: GrantCreditsWithAuditParams,
): Promise<Tables<"credit_grants">> {
  const { data, error } = await supabase.rpc("grant_credits_with_audit", {
    p_account_id: params.accountId,
    p_granted_by: params.grantedBy,
    p_reason: params.reason,
    p_remaining_credits: params.remainingCredits,
  });

  if (error) {
    console.error("[ERROR] grantCreditsWithAudit:", error);
    throw error;
  }

  if (!data) {
    throw new Error(`Grant returned no row for account_id: ${params.accountId}`);
  }

  return data;
}
