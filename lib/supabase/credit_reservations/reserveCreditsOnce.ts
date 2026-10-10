import { z } from "zod";
import supabase from "../serverClient";
import {
  validateCreditReservation,
  type CreditReservationInput,
} from "@/lib/credits/reservations/validateCreditReservation";
import { CreditReservationNeedsReconciliation } from "@/lib/credits/reservations/CreditReservationNeedsReconciliation";
import { CreditReservationRejected } from "@/lib/credits/reservations/CreditReservationRejected";
import { toCreditReservationRejection } from "@/lib/credits/reservations/toCreditReservationRejection";

const reservationId = z.string().regex(/^hold-v1-[a-f0-9]{64}$/);
const credits = z.number().int().positive();
const receiptSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("held"),
    reservationId,
    creditsHeld: credits,
    spendableCredits: z.number().int().min(0),
  }),
  z.strictObject({
    state: z.literal("reused"),
    reservationId,
    status: z.enum(["held", "settled", "released"]),
    creditsHeld: credits,
  }),
  z.strictObject({
    state: z.literal("insufficient"),
    creditsRequested: credits,
    spendableCredits: z.number().int(),
  }),
]);
export type CreditReservationReceipt = z.infer<typeof receiptSchema>;

/**
 * Opt-in server-only hold on the existing wallet before paid AI work starts. The caller
 * resolves/authorizes the billing owner and supplies one stable key per chargeable attempt.
 * `insufficient` is a definite denial (nothing held); paid work may start only on a hold
 * whose status is `held`. A rolled-back database rejection throws `CreditReservationRejected`.
 * No debit, usage event, provider call or auto-top-up happens here.
 */
export async function reserveCreditsOnce(
  input: CreditReservationInput,
): Promise<CreditReservationReceipt> {
  const args = validateCreditReservation(input);
  // The additive RPC is narrowly typed here until generated types follow database release.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "reserve_credits_once",
    params: { p_account_id: string; p_operation_key: string; p_credits: number },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  try {
    const { data, error } = await rpc("reserve_credits_once", {
      p_account_id: args.accountId,
      p_operation_key: args.operationKey,
      p_credits: args.creditsToReserve,
    });
    if (error) throw toCreditReservationRejection(error) ?? error;
    const receipt = receiptSchema.parse(data);
    const amount =
      receipt.state === "insufficient" ? receipt.creditsRequested : receipt.creditsHeld;
    if (amount !== args.creditsToReserve) throw new Error("Credit reservation receipt mismatch");
    return receipt;
  } catch (cause) {
    if (cause instanceof CreditReservationRejected) throw cause;
    throw new CreditReservationNeedsReconciliation(cause);
  }
}
