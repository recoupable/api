import { z } from "zod";
import supabase from "../serverClient";
import {
  validateCreditCharge,
  type CreditChargeInput,
} from "@/lib/credits/charges/validateCreditCharge";
import { CreditChargeNeedsReconciliation } from "@/lib/credits/charges/CreditChargeNeedsReconciliation";
import { CreditReservationRejected } from "@/lib/credits/reservations/CreditReservationRejected";
import { toCreditReservationRejection } from "@/lib/credits/reservations/toCreditReservationRejection";
import type { Json } from "@/types/database.types";

const credits = z.number().int().positive();
const receiptSchema = z.strictObject({
  state: z.enum(["settled", "reused"]),
  reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
  eventId: z.string().regex(/^charge-v1-[a-f0-9]{64}$/),
  creditsHeld: credits,
  creditsCharged: credits,
  creditsReleased: z.number().int().min(0),
});
export type CreditSettlementReceipt = z.infer<typeof receiptSchema>;

/**
 * Charge the actual credits for a held reservation and release the remainder. The charge
 * goes through the same owner/key receipt as `recordCreditChargeOnce`, so a retry after a
 * lost reply returns `reused`. A rolled-back database rejection throws
 * `CreditReservationRejected`; any other failure may have committed: keep the key and reconcile.
 * Auto-top-up is not triggered here.
 */
export async function settleCreditReservation(
  input: CreditChargeInput,
): Promise<CreditSettlementReceipt> {
  const args = validateCreditCharge(input);
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "settle_credit_reservation",
    params: { p_account_id: string; p_operation_key: string; p_credits: number; p_event: Json },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  try {
    const { data, error } = await rpc("settle_credit_reservation", {
      p_account_id: args.accountId,
      p_operation_key: args.operationKey,
      p_credits: args.creditsToDeduct,
      p_event: args.event,
    });
    if (error) throw toCreditReservationRejection(error) ?? error;
    const receipt = receiptSchema.parse(data);
    if (
      receipt.creditsCharged !== args.creditsToDeduct ||
      receipt.creditsHeld - receipt.creditsCharged !== receipt.creditsReleased
    ) {
      throw new Error("Credit settlement receipt mismatch");
    }
    return receipt;
  } catch (cause) {
    if (cause instanceof CreditReservationRejected) throw cause;
    throw new CreditChargeNeedsReconciliation(cause);
  }
}
