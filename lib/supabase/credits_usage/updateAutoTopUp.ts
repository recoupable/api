import serverClient from "@/lib/supabase/serverClient";
import {
  AUTO_TOP_UP_COLUMNS,
  pickAutoTopUpRow,
  type AutoTopUpRow,
} from "@/lib/supabase/credits_usage/pickAutoTopUpRow";

interface UpdateAutoTopUpParams {
  accountId: string;
  enabled: boolean;
  /** Credit micro-dollars. */
  amountCredits: number;
  /** Credit micro-dollars. */
  thresholdCredits: number;
}

/**
 * Writes the three auto top-up settings. Enabling also clears the last
 * decline message so a re-enabled account starts healthy; disabling keeps it
 * so the billing page can still show why it went off. Null when the account
 * has no `credits_usage` row.
 */
export async function updateAutoTopUp({
  accountId,
  enabled,
  amountCredits,
  thresholdCredits,
}: UpdateAutoTopUpParams): Promise<AutoTopUpRow | null> {
  const updates: Record<string, unknown> = {
    auto_topup_enabled: enabled,
    auto_topup_amount: amountCredits,
    auto_topup_threshold: thresholdCredits,
  };
  if (enabled) updates.auto_topup_last_error = null;

  const { data, error } = await serverClient
    .from("credits_usage")
    // Cast until `pnpm update-types` picks up database#69 (see pickAutoTopUpRow.ts).
    .update(updates as never)
    .eq("account_id", accountId)
    .select(AUTO_TOP_UP_COLUMNS as "*")
    .maybeSingle();

  if (error) {
    console.error("[updateAutoTopUp]", error);
    throw error;
  }

  return data ? pickAutoTopUpRow(data as unknown as Record<string, unknown>) : null;
}
