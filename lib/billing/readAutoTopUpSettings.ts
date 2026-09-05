import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { pickAutoTopUpRow, type AutoTopUpRow } from "@/lib/billing/pickAutoTopUpRow";

/**
 * Auto top-up settings for an account, or null when it has no credits row
 * yet (the documented "never configured" defaults).
 */
export async function readAutoTopUpSettings(accountId: string): Promise<AutoTopUpRow | null> {
  const rows = await selectCreditsUsage({ account_id: accountId });
  const row = rows[0];
  return row ? pickAutoTopUpRow(row) : null;
}
