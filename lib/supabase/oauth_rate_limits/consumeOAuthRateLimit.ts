import supabase from "../serverClient";

type RateLimitRpc = (
  name: "consume_oauth_rate_limit",
  args: { p_namespace: string; p_keys: string[]; p_limits: number[] },
) => PromiseLike<{ data: unknown; error: unknown }>;

/** Check all budgets atomically in the existing authorization database. */
export async function consumeOAuthRateLimit(
  namespace: string,
  budgets: { key: string; limit: number }[],
) {
  try {
    // Narrow contract until generated Database types include the new migration.
    const { data, error } = await (supabase.rpc.bind(supabase) as unknown as RateLimitRpc)(
      "consume_oauth_rate_limit",
      {
        p_namespace: namespace,
        p_keys: budgets.map(b => b.key),
        p_limits: budgets.map(b => b.limit),
      },
    );
    if (error || typeof data !== "number" || !Number.isInteger(data) || data < 0 || data > 60)
      throw new Error();
    return data;
  } catch {
    throw new Error("OAuth throttling unavailable");
  }
}
