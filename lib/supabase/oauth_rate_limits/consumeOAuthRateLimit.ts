import supabase from "../serverClient";

type RateLimitRpc = (
  name: "consume_oauth_rate_limit",
  args: { p_namespace: string; p_keys: string[]; p_limits: number[] },
) => { abortSignal(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }> };

/** Check all budgets atomically in the existing authorization database. */
export async function consumeOAuthRateLimit(
  namespace: string,
  budgets: { key: string; limit: number }[],
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Narrow contract until generated Database types include the new migration.
    const request = (supabase.rpc.bind(supabase) as unknown as RateLimitRpc)(
      "consume_oauth_rate_limit",
      {
        p_namespace: namespace,
        p_keys: budgets.map(b => b.key),
        p_limits: budgets.map(b => b.limit),
      },
    ).abortSignal(controller.signal);
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error());
      }, 2000);
    });
    const { data, error } = await Promise.race([request, timeout]);
    if (error || typeof data !== "number" || !Number.isInteger(data) || data < 0 || data > 60)
      throw new Error();
    return data;
  } catch {
    throw new Error("OAuth throttling unavailable");
  } finally {
    clearTimeout(timer);
  }
}
