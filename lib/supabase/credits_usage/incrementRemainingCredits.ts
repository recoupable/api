import { z } from "zod";
import supabase from "../serverClient";

const receiptSchema = z.strictObject({ remainingCredits: z.number().int() });
export type CreditIncrementReceipt = z.infer<typeof receiptSchema>;

interface IncrementRemainingCreditsParams {
  accountId: string;
  delta: number;
}

/**
 * Adds `delta` credits to the account's single wallet row in one locked database
 * statement (`increment_credits_atomic`), so a debit or refill landing between a
 * read and a write can no longer be lost. Leaves the refill timestamp alone and
 * writes no usage event. Used by the Stripe credit top-up handlers.
 */
export const incrementRemainingCredits = async ({
  accountId,
  delta,
}: IncrementRemainingCreditsParams): Promise<CreditIncrementReceipt> => {
  if (!Number.isInteger(delta) || delta <= 0) {
    throw new Error("delta must be a positive integer");
  }
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "increment_credits_atomic",
    params: { p_account_id: string; p_delta: number },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc("increment_credits_atomic", {
    p_account_id: accountId,
    p_delta: delta,
  });
  if (error) {
    console.error("Error incrementing credits usage:", error);
    throw error;
  }
  return receiptSchema.parse(data);
};
