import { z } from "zod";
import supabase from "../serverClient";
import {
  validateCreditReservationRelease,
  type CreditReservationReleaseInput,
} from "@/lib/credits/reservations/validateCreditReservationRelease";
import { CreditReservationNeedsReconciliation } from "@/lib/credits/reservations/CreditReservationNeedsReconciliation";

const credits = z.number().int().positive();
const receiptSchema = z.strictObject({
  state: z.enum(["released", "reused"]),
  reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
  creditsHeld: credits,
  creditsReleased: credits,
});
export type CreditReleaseReceipt = z.infer<typeof receiptSchema>;

/**
 * Release an unsettled hold without any charge, for work known not to have incurred
 * one (for example, cancelled before dispatch). Uncertain provider work stays held until
 * reconciled; release is never a timeout. No usage event or balance write happens here.
 */
export async function releaseCreditReservation(
  input: CreditReservationReleaseInput,
): Promise<CreditReleaseReceipt> {
  const args = validateCreditReservationRelease(input);
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "release_credit_reservation",
    params: { p_account_id: string; p_operation_key: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  try {
    const { data, error } = await rpc("release_credit_reservation", {
      p_account_id: args.accountId,
      p_operation_key: args.operationKey,
    });
    if (error) throw error;
    const receipt = receiptSchema.parse(data);
    if (receipt.creditsReleased !== receipt.creditsHeld) {
      throw new Error("Credit release receipt mismatch");
    }
    return receipt;
  } catch (cause) {
    throw new CreditReservationNeedsReconciliation(cause);
  }
}
