import { z } from "zod";
import supabase from "../serverClient";

const receiptSchema = z.strictObject({
  state: z.enum(["raised", "unchanged", "superseded"]),
  remainingCredits: z.number().int(),
  timestamp: z.string().min(1),
});
export type CreditRefillReceipt = z.infer<typeof receiptSchema>;

interface RefillCreditsToFloorParams {
  accountId: string;
  floor: number;
  /** The wallet's refill timestamp exactly as read when the refill was judged due. */
  expectedTimestamp: string;
}

/**
 * Raises the account's single wallet row to at least `floor` credits and advances its
 * refill timestamp in one locked database statement (`refill_credits_to_floor`). The
 * database applies GREATEST(remaining_credits, floor) itself, so a balance read earlier
 * is never written back over a concurrent atomic debit, top-up or grant. Under the same
 * lock it first checks that the refill timestamp still equals `expectedTimestamp`; if
 * another refill or a grant has moved it, the receipt is `superseded` with the current
 * balance and nothing changes, so a period is refilled once and a debit taken after
 * that refill is not resurrected. Writes no usage event and never calls auto-top-up;
 * not a reservation or spending authorization.
 */
export async function refillCreditsToFloor({
  accountId,
  floor,
  expectedTimestamp,
}: RefillCreditsToFloorParams): Promise<CreditRefillReceipt> {
  if (!Number.isInteger(floor) || floor < 0) {
    throw new Error("floor must be a non-negative integer");
  }
  if (!expectedTimestamp) {
    throw new Error("the observed refill timestamp is required");
  }
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "refill_credits_to_floor",
    params: { p_account_id: string; p_floor: number; p_expected_timestamp: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc("refill_credits_to_floor", {
    p_account_id: accountId,
    p_floor: floor,
    p_expected_timestamp: expectedTimestamp,
  });
  if (error) {
    console.error("Error refilling credits usage:", error);
    throw error;
  }
  return receiptSchema.parse(data);
}
