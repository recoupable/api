import supabase from "@/lib/supabase/serverClient";

/**
 * One ranked account in the credit-spend digest, as returned by the
 * `get_credit_spend_digest` Postgres function.
 */
export interface CreditSpendDigestRow {
  account_id: string;
  account_name: string | null;
  account_email: string | null;
  total_cents: number;
  turn_count: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  tool_calls: number;
  main_cents: number;
  subagent_cents: number;
  /** Credits (cents) per model id; `model_id IS NULL` bucketed as `"unknown"`. */
  by_model: Record<string, number>;
}

/**
 * Reads the top-spending accounts over a time window via the
 * `get_credit_spend_digest` aggregation function (single round trip;
 * grouping + ranking happen in Postgres). Rows come back ordered by
 * total spend descending.
 *
 * @param sinceIso - Lower bound on `usage_events.created_at` (ISO string).
 * @param limit - Max accounts to return (clamped to [1, 1000] in SQL).
 * @returns Ranked spend rows; empty array when no spend in the window.
 */
export async function getCreditSpendDigest(
  sinceIso: string,
  limit: number,
): Promise<CreditSpendDigestRow[]> {
  // The function isn't in the generated Database types yet, so type the
  // rpc boundary explicitly rather than widening the shared client.
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: "get_credit_spend_digest",
      args: { p_since: string; p_limit: number },
    ) => Promise<{ data: CreditSpendDigestRow[] | null; error: { message: string } | null }>
  )("get_credit_spend_digest", { p_since: sinceIso, p_limit: limit });

  if (error) {
    console.error("Error calling get_credit_spend_digest:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}
