import serverClient from "@/lib/supabase/serverClient";
import { AUTO_TOPUP_LEASE_MS } from "@/lib/credits/autoTopUpLease";

interface ClaimAutoTopUpLeaseParams {
  accountId: string;
  now: Date;
  /** The amount the caller read; the claim fails if it changed since. */
  amountCredits: number;
  /** The threshold the caller read; the balance must still be below it. */
  thresholdCredits: number;
}

export interface AutoTopUpLease {
  stamp: string;
  amountCredits: number;
}

/**
 * Stamps `auto_topup_last_run_at` in one conditional UPDATE that only matches
 * when auto top-up is still enabled, the amount is still the one the caller
 * read, the threshold is still set, the balance is still below that threshold,
 * and no attempt ran in the last ten minutes. Exactly one concurrent caller
 * can win the row. Returns the stamp and the locked amount to charge, or null.
 * A disable committed between this claim and the Stripe call (milliseconds)
 * is accepted; the next attempt sees `enabled = false` and skips.
 */
export async function claimAutoTopUpLease({
  accountId,
  now,
  amountCredits,
  thresholdCredits,
}: ClaimAutoTopUpLeaseParams): Promise<AutoTopUpLease | null> {
  const stamp = now.toISOString();
  const cutoff = new Date(now.getTime() - AUTO_TOPUP_LEASE_MS).toISOString();

  const { data, error } = await serverClient
    .from("credits_usage")
    .update({ auto_topup_last_run_at: stamp })
    .eq("account_id", accountId)
    .eq("auto_topup_enabled", true)
    .eq("auto_topup_amount", amountCredits)
    .not("auto_topup_threshold", "is", null)
    .lt("remaining_credits", thresholdCredits)
    .or(`auto_topup_last_run_at.is.null,auto_topup_last_run_at.lt.${cutoff}`)
    .select("auto_topup_amount")
    .maybeSingle();

  if (error) {
    console.error("[claimAutoTopUpLease]", error);
    throw error;
  }

  return data?.auto_topup_amount != null ? { stamp, amountCredits: data.auto_topup_amount } : null;
}
