import { z } from "zod";
import { getContextAccountingKey } from "./getContextAccountingKey";
import { validateCreditCharge } from "@/lib/credits/charges/validateCreditCharge";
import { validateContextAccountingInput } from "./validateContextAccountingInput";
import { admitContextAccountingAttempt } from "./admitContextAccountingAttempt";
import { finishContextAccountingAttempt } from "./finishContextAccountingAttempt";
import type { ContextAccountingServices } from "./types";

/** Disabled consumer: all effects injected; no production caller, wallet, provider or policy defaults. */
export async function runContextAccountingAttempt(
  raw: unknown,
  services: ContextAccountingServices,
) {
  const input = validateContextAccountingInput(raw);
  await services.authorize(input);
  const prior = await services.transact(input.payerId, ledger => {
    const current = ledger.attempts.get(getContextAccountingKey(input));
    if (current && JSON.stringify(current.input) !== JSON.stringify(input))
      throw new Error("Attempt terms changed");
    return current ? structuredClone(current) : null;
  });
  if (prior)
    return {
      state: ["settled", "released", "insufficient", "reused"].includes(prior.phase)
        ? prior.phase
        : "pending_reconciliation",
      operationKey: prior.operationKey,
      completion: prior.completion,
      ...(prior.phase === "reused" ? { resultId: prior.reuseResultId, customerCredits: 0 } : {}),
    };
  const reused = await services.findAcceptedReuse(input);
  const admission = await services.transact(input.payerId, ledger =>
    admitContextAccountingAttempt(
      input,
      ledger,
      reused ? z.string().min(1).max(200).parse(reused.resultId) : undefined,
    ),
  );
  if (!admission.attempt) return { state: "denied" as const };
  const { operationKey } = admission.attempt;
  if (admission.attempt.phase === "reused")
    return {
      state: "reused" as const,
      operationKey,
      resultId: admission.attempt.reuseResultId,
      customerCredits: 0,
    };
  if (!admission.created)
    return {
      state: ["settled", "released", "insufficient", "reused"].includes(admission.attempt.phase)
        ? admission.attempt.phase
        : "pending_reconciliation",
      operationKey,
    };
  try {
    const hold = z
      .discriminatedUnion("state", [
        z.strictObject({
          state: z.literal("held"),
          reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
          creditsHeld: z.number().int().positive().safe(),
          spendableCredits: z.number().int().nonnegative().safe(),
        }),
        z.strictObject({
          state: z.literal("reused"),
          reservationId: z.string().regex(/^hold-v1-[a-f0-9]{64}$/),
          status: z.enum(["held", "settled", "released"]),
          creditsHeld: z.number().int().positive().safe(),
        }),
        z.strictObject({
          state: z.literal("insufficient"),
          creditsRequested: z.number().int().positive().safe(),
          spendableCredits: z.number().int().safe(),
        }),
      ])
      .parse(
        await services.reserveCreditsOnce({
          accountId: input.payerId,
          operationKey,
          creditsToReserve: input.maximumCredits,
        }),
      );
    if (hold.state === "insufficient") {
      if (hold.creditsRequested !== input.maximumCredits) throw new Error("Reservation mismatch");
      await services.transact(input.payerId, ledger => {
        ledger.attempts.get(operationKey)!.phase = "insufficient";
      });
      return { state: "insufficient" as const, operationKey };
    }
    // A reused hold is NOT permission to dispatch after a lost journal or acknowledgement.
    if (
      hold.state !== "held" ||
      hold.creditsHeld !== input.maximumCredits ||
      !/^hold-v1-[a-f0-9]{64}$/.test(hold.reservationId)
    )
      throw new Error("Reservation requires reconciliation");
    const attempt = await services.transact(input.payerId, ledger => {
      const current = ledger.attempts.get(operationKey)!;
      if (current.phase !== "admitted") throw new Error("Attempt phase changed");
      current.reservationId = hold.reservationId;
      // Cancellation and dispatch intent compete atomically in the owning journal.
      current.phase = ledger.cancelled.has(operationKey) ? "cancelled" : "dispatching";
      return structuredClone(current);
    });
    if (attempt.phase === "cancelled") return finishContextAccountingAttempt(attempt, services);
    await services.authorize(input);
    const completion = z
      .strictObject({
        resultId: z.string().min(1).max(200),
        usable: z.boolean(),
        customerCredits: z.number().int().min(0).max(input.maximumCredits),
        providerExpense: z.discriminatedUnion("status", [
          z.strictObject({ status: z.literal("unknown") }),
          z.strictObject({
            status: z.enum(["confirmed", "estimated"]),
            usd: z.number().finite().nonnegative(),
          }),
        ]),
        event: z.record(z.string(), z.unknown()),
      })
      .parse(await services.dispatch(input));
    // Reuse the existing strict usage-event validator. No attribution fields are added to it.
    const charge = validateCreditCharge({
      accountId: input.payerId,
      operationKey,
      creditsToDeduct: completion.customerCredits || 1,
      event: completion.event,
    });
    const completed = await services.transact(input.payerId, ledger => {
      const current = ledger.attempts.get(operationKey)!;
      if (current.phase !== "dispatching") throw new Error("Attempt phase changed");
      current.completion = {
        ...completion,
        providerExpense: completion.providerExpense,
        event: charge.event,
      };
      current.phase = "completed";
      return structuredClone(current);
    });
    return finishContextAccountingAttempt(completed, services);
  } catch {
    // Journal phase retains maximum exposure; no automatic release, debit or provider retry.
    return { state: "pending_reconciliation" as const, operationKey };
  }
}
