import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { pickAutoTopUpRow, type AutoTopUpRow } from "@/lib/billing/pickAutoTopUpRow";

export interface AutoTopUpSettings {
  accountId: string;
  enabled: boolean;
  amountCredits: number;
  thresholdCredits: number;
}

const isMissingRow = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith("No credits usage found");

/**
 * Writes the auto top-up settings onto the account's credits row. Accounts
 * without a row yet (organizations) get one from their plan first, then the
 * write is retried once; a concurrent first save that loses the insert race
 * still lands on the retry.
 */
export async function saveAutoTopUpSettings(
  settings: AutoTopUpSettings,
): Promise<AutoTopUpRow | null> {
  const { accountId, enabled, amountCredits, thresholdCredits } = settings;
  const updates = {
    auto_topup_enabled: enabled,
    auto_topup_amount: amountCredits,
    auto_topup_threshold: thresholdCredits,
    ...(enabled ? { auto_topup_last_error: null } : {}),
  };
  const write = async () =>
    // Cast until `pnpm update-types` picks up database#69 (see pickAutoTopUpRow.ts).
    updateCreditsUsage({ account_id: accountId, updates: updates as never });

  try {
    return pickAutoTopUpRow((await write()) as unknown as Record<string, unknown>);
  } catch (error) {
    if (!isMissingRow(error)) throw error;
    await initializeAccountCredits(accountId);
    try {
      return pickAutoTopUpRow((await write()) as unknown as Record<string, unknown>);
    } catch (retryError) {
      if (isMissingRow(retryError)) return null;
      throw retryError;
    }
  }
}
