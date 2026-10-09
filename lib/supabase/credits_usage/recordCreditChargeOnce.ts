import { z } from "zod";
import supabase from "../serverClient";
import {
  validateCreditCharge,
  type CreditChargeInput,
} from "@/lib/credits/charges/validateCreditCharge";
import { CreditChargeNeedsReconciliation } from "@/lib/credits/charges/CreditChargeNeedsReconciliation";
import type { Json } from "@/types/database.types";

const receiptSchema = z.strictObject({
  state: z.enum(["charged", "reused"]),
  eventId: z.string().regex(/^charge-v1-[a-f0-9]{64}$/),
  creditsCharged: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type CreditChargeReceipt = z.infer<typeof receiptSchema>;

/**
 * Opt-in server-only receipt adapter. Caller must resolve/authorize the billing owner,
 * supply a stable work identity and an approved charge. This neither reserves funds
 * nor calls providers or auto-top-up. No live callers until spending controls are ready.
 */
export async function recordCreditChargeOnce(
  input: CreditChargeInput,
): Promise<CreditChargeReceipt> {
  const args = validateCreditCharge(input);
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "record_credit_charge_once",
    params: { p_account_id: string; p_operation_key: string; p_amount: number; p_event: Json },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  try {
    const { data, error } = await rpc("record_credit_charge_once", {
      p_account_id: args.accountId,
      p_operation_key: args.operationKey,
      p_amount: args.creditsToDeduct,
      p_event: args.event,
    });
    if (error) throw error;
    const receipt = receiptSchema.parse(data);
    if (receipt.creditsCharged !== args.creditsToDeduct) throw new Error("Charge receipt mismatch");
    return receipt;
  } catch (cause) {
    throw new CreditChargeNeedsReconciliation(cause);
  }
}
