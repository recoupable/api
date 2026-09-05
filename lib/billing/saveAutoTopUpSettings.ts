import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { pickAutoTopUpRow, type AutoTopUpRow } from "@/lib/billing/pickAutoTopUpRow";

export interface AutoTopUpSettings {
  accountId: string;
  enabled: boolean;
  amountCredits: number;
  thresholdCredits: number;
}

// updateCreditsUsage surfaces a missing row either as PostgREST's PGRST116
// (.single() over zero rows) or as its own "No credits usage found" error.
const isMissingRow = (error: unknown): boolean =>
  (typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "PGRST116") ||
  (error instanceof Error && error.message.startsWith("No credits usage found"));

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
  const write = () => updateCreditsUsage({ account_id: accountId, updates });

  try {
    return pickAutoTopUpRow(await write());
  } catch (error) {
    if (!isMissingRow(error)) throw error;
    await initializeAccountCredits(accountId);
    try {
      return pickAutoTopUpRow(await write());
    } catch (retryError) {
      if (isMissingRow(retryError)) return null;
      throw retryError;
    }
  }
}
