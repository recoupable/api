import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";
import type { AutoTopUpOutcome } from "@/lib/credits/maybeAutoTopUp";

interface DisableAutoTopUpAfterFailureParams {
  accountId: string;
  amountCents: number;
  message: string;
  /** The last_run_at this run wrote; a newer stamp means another run owns the row now. */
  stamp: string;
}

/**
 * Turns auto top-up off after a failed charge and tells the account why,
 * unless a later run has stamped the row since (its settings win).
 */
export async function disableAutoTopUpAfterFailure({
  accountId,
  amountCents,
  message,
  stamp,
}: DisableAutoTopUpAfterFailureParams): Promise<AutoTopUpOutcome> {
  const current = await readAutoTopUpSettings(accountId);
  if (current?.auto_topup_last_run_at !== stamp) return { kind: "skipped" };
  await updateCreditsUsage({
    account_id: accountId,
    updates: { auto_topup_enabled: false, auto_topup_last_error: message },
  });
  await sendAutoTopUpEmail({ accountId, kind: "declined", amountCents, message });
  return { kind: "disabled", message };
}
