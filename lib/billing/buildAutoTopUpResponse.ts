import { creditsToStripeCents } from "@/lib/credits/creditsToStripeCents";
import type { AutoTopUpRow } from "@/lib/billing/pickAutoTopUpRow";

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
    amountCents:
      row.auto_topup_amount === null ? null : creditsToStripeCents(row.auto_topup_amount),
    thresholdCents:
      row.auto_topup_threshold === null ? null : creditsToStripeCents(row.auto_topup_threshold),
    lastRunAt: row.auto_topup_last_run_at,
    lastError: row.auto_topup_last_error,
  };
}
