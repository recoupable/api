import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { shouldAutoTopUp } from "@/lib/credits/shouldAutoTopUp";

export interface AutoTopUpDecision {
  amountCredits: number;
  /** The last_run_at read before this run stamps the row; seeds the idempotency key. */
  previousRunAt: string | null;
}

/** Reads the account's settings and balance; null when no top-up should run now. */
export async function decideAutoTopUp(
  accountId: string,
  now: Date,
): Promise<AutoTopUpDecision | null> {
  const settings = await readAutoTopUpSettings(accountId);
  if (!settings?.auto_topup_enabled || settings.auto_topup_amount === null) return null;
  const [usage] = await selectCreditsUsage({ account_id: accountId });
  if (!usage) return null;
  const run = shouldAutoTopUp({
    enabled: settings.auto_topup_enabled,
    amountCredits: settings.auto_topup_amount,
    thresholdCredits: settings.auto_topup_threshold,
    lastRunAt: settings.auto_topup_last_run_at,
    remainingCredits: usage.remaining_credits,
    now,
  });
  return run
    ? { amountCredits: settings.auto_topup_amount, previousRunAt: settings.auto_topup_last_run_at }
    : null;
}
