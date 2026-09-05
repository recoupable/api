import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";
import type { AutoTopUpOutcome } from "@/lib/credits/maybeAutoTopUp";

/** Turns auto top-up off after a failed charge and tells the account why. */
export async function disableAutoTopUpAfterFailure(
  accountId: string,
  amountCents: number,
  message: string,
): Promise<AutoTopUpOutcome> {
  await updateCreditsUsage({
    account_id: accountId,
    updates: { auto_topup_enabled: false, auto_topup_last_error: message },
  });
  await sendAutoTopUpEmail({ accountId, kind: "declined", amountCents, message });
  return { kind: "disabled", message };
}
