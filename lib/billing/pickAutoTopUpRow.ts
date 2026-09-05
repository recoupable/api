import type { Tables } from "@/types/database.types";

export type AutoTopUpRow = Pick<
  Tables<"credits_usage">,
  | "account_id"
  | "auto_topup_enabled"
  | "auto_topup_amount"
  | "auto_topup_threshold"
  | "auto_topup_last_run_at"
  | "auto_topup_last_error"
>;

/** The auto top-up settings columns of a credits_usage row. */
export function pickAutoTopUpRow(row: Tables<"credits_usage">): AutoTopUpRow {
  return {
    account_id: row.account_id,
    auto_topup_enabled: row.auto_topup_enabled,
    auto_topup_amount: row.auto_topup_amount,
    auto_topup_threshold: row.auto_topup_threshold,
    auto_topup_last_run_at: row.auto_topup_last_run_at,
    auto_topup_last_error: row.auto_topup_last_error,
  };
}
