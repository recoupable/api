import { updateAutoTopUpFailure } from "@/lib/supabase/credits_usage/updateAutoTopUpFailure";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";
import type { AutoTopUpOutcome } from "@/lib/credits/maybeAutoTopUp";

/**
 * Turns auto top-up off with the failure reason and tells the account, so a
 * declining card is never retried on the next deduction.
 */
export async function disableAutoTopUpAfterFailure(
  accountId: string,
  amountCents: number,
  message: string,
): Promise<AutoTopUpOutcome> {
  await updateAutoTopUpFailure({ accountId, message });
  await sendAutoTopUpEmail({ accountId, kind: "declined", amountCents, message });
  return { kind: "disabled", message };
}
