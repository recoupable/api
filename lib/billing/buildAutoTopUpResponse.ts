import { creditsToCents } from "@/lib/billing/creditsToCents";
import type { AutoTopUpRow } from "@/lib/supabase/credits_usage/autoTopUpColumns";

export interface AutoTopUpResponse {
  account_id: string;
  enabled: boolean;
  amountCents: number | null;
  thresholdCents: number | null;
  lastRunAt: string | null;
  lastError: string | null;
}

/**
 * Shapes the documented `AutoTopUpResponse`. A missing row is the documented
 * default: off, nothing set, never run.
 */
export function buildAutoTopUpResponse(args: {
  accountId: string;
  row: AutoTopUpRow | null;
}): AutoTopUpResponse {
  const { accountId, row } = args;
  if (!row) {
    return {
      account_id: accountId,
      enabled: false,
      amountCents: null,
      thresholdCents: null,
      lastRunAt: null,
      lastError: null,
    };
  }
  return {
    account_id: accountId,
    enabled: row.auto_topup_enabled,
    amountCents: creditsToCents(row.auto_topup_amount),
    thresholdCents: creditsToCents(row.auto_topup_threshold),
    lastRunAt: row.auto_topup_last_run_at,
    lastError: row.auto_topup_last_error,
  };
}
