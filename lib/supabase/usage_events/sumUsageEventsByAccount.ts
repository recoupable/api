import supabase from "@/lib/supabase/serverClient";

interface SumUsageEventsByAccountParams {
  accountId: string;
  /** Inclusive lower bound on `created_at` (ISO string). */
  from: string;
  /** Exclusive upper bound on `created_at` (ISO string). */
  to: string;
}

/**
 * Total credits deducted for an account within a period, summed in Postgres
 * (PostgREST aggregate) so the figure covers the whole period regardless of
 * pagination.
 *
 * @param params - Account and period bounds.
 * @returns The sum of `credits_deducted`, 0 when there are no events.
 */
export async function sumUsageEventsByAccount(
  params: SumUsageEventsByAccountParams,
): Promise<number> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("credits_deducted.sum()")
    .eq("account_id", params.accountId)
    .gte("created_at", params.from)
    .lt("created_at", params.to);
  if (error) {
    console.error("Error summing usage_events by account:", error);
    throw error;
  }
  const row = (data as unknown as Array<{ sum: number | null }> | null)?.[0];
  return Number(row?.sum ?? 0);
}
