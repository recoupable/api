import serverClient from "@/lib/supabase/serverClient";
import { AUTO_TOPUP_LEASE_MS } from "@/lib/credits/autoTopUpPurpose";

interface ClaimAutoTopUpLeaseParams {
  accountId: string;
  now: Date;
}

/**
 * Stamps `auto_topup_last_run_at` for the account, but only when auto top-up
 * is on and the previous stamp is null or older than the lease window. The
 * conditional UPDATE is the concurrency guard: two deductions crossing the
 * threshold at once both call this, and only one gets a row back.
 *
 * Returns the stamp (ISO) when this caller won the lease, null otherwise.
 */
export async function claimAutoTopUpLease({
  accountId,
  now,
}: ClaimAutoTopUpLeaseParams): Promise<string | null> {
  const stamp = now.toISOString();
  const cutoff = new Date(now.getTime() - AUTO_TOPUP_LEASE_MS).toISOString();

  const { data, error } = await serverClient
    .from("credits_usage")
    // Cast until `pnpm update-types` picks up database#69 (see autoTopUpColumns.ts).
    .update({ auto_topup_last_run_at: stamp })
    .eq("account_id", accountId)
    .eq("auto_topup_enabled" as never, true)
    .or(`auto_topup_last_run_at.is.null,auto_topup_last_run_at.lt.${cutoff}`)
    .select("account_id")
    .maybeSingle();

  if (error) {
    console.error("[claimAutoTopUpLease]", error);
    throw error;
  }

  return data ? stamp : null;
}
