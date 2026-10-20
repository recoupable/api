import { z } from "zod";
import supabase from "../serverClient";
import { selectCreditsUsage, type CreditsUsage } from "./selectCreditsUsage";
/** Add credits atomically while preserving this helper's existing wallet-row return shape. */
export async function incrementRemainingCredits({
  accountId,
  delta,
}: {
  accountId: string;
  delta: number;
}): Promise<CreditsUsage> {
  if (!Number.isSafeInteger(delta) || delta <= 0)
    throw new Error("delta must be a positive integer");
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("increment_credits_atomic", {
    p_account_id: accountId,
    p_delta: delta,
  });
  if (error) throw new Error(error.message);
  const receipt = z.strictObject({ remainingCredits: z.number().int() }).parse(data);
  const rows = await selectCreditsUsage({ account_id: accountId });
  if (rows.length !== 1) throw new Error("No credits usage found or ambiguous wallet");
  return { ...rows[0], remaining_credits: receipt.remainingCredits };
}
