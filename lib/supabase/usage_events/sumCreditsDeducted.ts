import supabase from "@/lib/supabase/serverClient";

const PAGE_SIZE = 1000;

/**
 * Total `credits_deducted` for an account since a point in time, paged
 * through in full so the number is never partial.
 *
 * @param params.accountId - Account to total.
 * @param params.createdAfter - Inclusive ISO lower bound on `created_at`.
 * @returns Credits (ledger units), 0 on error.
 */
export async function sumCreditsDeducted(params: {
  accountId: string;
  createdAfter: string;
}): Promise<number> {
  let total = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("usage_events")
      .select("credits_deducted")
      .eq("account_id", params.accountId)
      .gte("created_at", params.createdAfter)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error summing usage_events.credits_deducted:", error);
      return 0;
    }
    const rows = data ?? [];
    total += rows.reduce((sum, row) => sum + (row.credits_deducted ?? 0), 0);
    if (rows.length < PAGE_SIZE) return total;
  }
}
