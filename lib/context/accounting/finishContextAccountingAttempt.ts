import { z } from "zod";
import type { ContextAccountingAttempt, ContextAccountingServices } from "./types";
/** Repeats only the exact settlement/release, never provider work. Unknown replies keep full exposure. */
export async function finishContextAccountingAttempt(
  attempt: ContextAccountingAttempt,
  services: ContextAccountingServices,
) {
  const { input, operationKey } = attempt;
  const completion = attempt.completion;
  if (!["completed", "cancelled"].includes(attempt.phase))
    return { state: "pending_reconciliation" as const, operationKey };
  try {
    const args = { accountId: input.payerId, operationKey };
    const released = attempt.phase === "cancelled" || completion?.customerCredits === 0;
    if (released) {
      const receipt = z
        .strictObject({
          state: z.enum(["released", "reused"]),
          reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
          creditsHeld: z.number().int().positive().safe(),
          creditsReleased: z.number().int().positive().safe(),
        })
        .parse(await services.releaseCreditReservation(args));
      if (
        receipt.reservationId !== attempt.reservationId ||
        receipt.creditsHeld !== input.maximumCredits ||
        receipt.creditsReleased !== input.maximumCredits
      )
        throw new Error("Release receipt mismatch");
    } else {
      const receipt = z
        .strictObject({
          state: z.enum(["settled", "reused"]),
          reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
          eventId: z.string().regex(/^charge-v1-[a-f0-9]{64}$/),
          creditsHeld: z.number().int().positive().safe(),
          creditsCharged: z.number().int().positive().safe(),
          creditsReleased: z.number().int().nonnegative().safe(),
        })
        .parse(
          await services.settleCreditReservation({
            ...args,
            creditsToDeduct: completion!.customerCredits,
            event: completion!.event,
          }),
        );
      if (
        receipt.reservationId !== attempt.reservationId ||
        receipt.creditsHeld !== input.maximumCredits ||
        receipt.creditsCharged !== completion!.customerCredits ||
        receipt.creditsReleased !== input.maximumCredits - completion!.customerCredits
      )
        throw new Error("Settlement receipt mismatch");
    }
    await services.transact(input.payerId, ledger => {
      const current = ledger.attempts.get(operationKey)!;
      if (![attempt.phase, released ? "released" : "settled"].includes(current.phase))
        throw new Error("Attempt phase changed");
      current.phase = released ? "released" : "settled";
    });
    return {
      state: released ? ("released" as const) : ("settled" as const),
      operationKey,
      completion,
    };
  } catch {
    return { state: "pending_reconciliation" as const, operationKey };
  }
}
