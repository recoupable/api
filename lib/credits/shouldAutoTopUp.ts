import { AUTO_TOPUP_LEASE_MS } from "@/lib/credits/autoTopUpLease";

interface ShouldAutoTopUpParams {
  enabled: boolean;
  amountCredits: number | null;
  thresholdCredits: number | null;
  lastRunAt: string | null;
  remainingCredits: number;
  now: Date;
}

/**
 * Pure decision: an auto top-up runs only when the account opted in with both
 * settings, the balance is below the threshold, and no attempt ran in the last
 * ten minutes. The stamp is written by `maybeAutoTopUp` before charging;
 * this check just avoids a write when nothing could run.
 */
export function shouldAutoTopUp({
  enabled,
  amountCredits,
  thresholdCredits,
  lastRunAt,
  remainingCredits,
  now,
}: ShouldAutoTopUpParams): boolean {
  if (!enabled || amountCredits === null || thresholdCredits === null) return false;
  if (remainingCredits >= thresholdCredits) return false;
  if (lastRunAt !== null) {
    const last = new Date(lastRunAt).getTime();
    // Fail closed on a malformed or empty stamp rather than charging.
    if (Number.isNaN(last) || now.getTime() - last < AUTO_TOPUP_LEASE_MS) return false;
  }
  return true;
}
