import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import type { CreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

interface IncrementRemainingCreditsParams {
  accountId: string;
  delta: number;
}

export const incrementRemainingCredits = async ({
  accountId,
  delta,
}: IncrementRemainingCreditsParams): Promise<CreditsUsage> => {
  if (!Number.isInteger(delta) || delta <= 0) {
    throw new Error("delta must be a positive integer");
  }

  const rows = await selectCreditsUsage({ account_id: accountId });
  if (!rows || rows.length === 0) {
    throw new Error(`No credits usage found for account_id: ${accountId}`);
  }

  const current = rows[0];
  const newBalance = current.remaining_credits + delta;

  return updateCreditsUsage({
    account_id: accountId,
    updates: { remaining_credits: newBalance },
  });
};
