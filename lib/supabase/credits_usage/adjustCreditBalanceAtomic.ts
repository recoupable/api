import supabase from "../serverClient";
import type { CreditsUsage } from "./selectCreditsUsage";
/** Serialize legacy credits additions/deductions with pack holds and monthly refills. */
export async function adjustCreditBalanceAtomic(
  accountId: string,
  delta: number,
): Promise<CreditsUsage> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("adjust_credit_balance_atomic", {
    p_account: accountId,
    p_delta: delta,
  });
  if (error) throw new Error(error.message);
  return data as CreditsUsage;
}
