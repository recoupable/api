import supabase from "@/lib/supabase/serverClient";

const MAX_ROWS = 10_000;

/**
 * Total `credits_deducted` for an account since a point in time.
 *
 * Summed in process over at most 10,000 rows: one trial's worth of usage
 * events is far below that, and it keeps the read on the existing table
 * grant instead of a new SQL function.
 *
 * @param params.accountId - Account to total.
 * @param params.createdAfter - Inclusive ISO lower bound on `created_at`.
 * @returns Credits (ledger units), 0 on error.
 */
export async function sumCreditsDeducted(params: {
  accountId: string;
  createdAfter: string;
}): Promise<number> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("credits_deducted")
    .eq("account_id", params.accountId)
    .gte("created_at", params.createdAfter)
    .range(0, MAX_ROWS - 1);

  if (error) {
    console.error("Error summing usage_events.credits_deducted:", error);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + (row.credits_deducted ?? 0), 0);
}
