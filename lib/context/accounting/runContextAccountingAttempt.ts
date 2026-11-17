import { z } from "zod";
import { getContextAccountingKey } from "./getContextAccountingKey";
import { validateContextReservationReceipt } from "./validateContextReservationReceipt";
import { validateContextAccountingCompletion } from "./validateContextAccountingCompletion";
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
      completion: admission.attempt.completion,
    };
  try {
    const hold = validateContextReservationReceipt(
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
    let authorizationFailed = false;
    try {
      await services.authorize(input);
    } catch {
      authorizationFailed = true;
    }
    const attempt = await services.transact(input.payerId, ledger => {
      const current = ledger.attempts.get(operationKey)!;
      if (current.phase !== "admitted") throw new Error("Attempt phase changed");
      current.reservationId = hold.reservationId;
      // Cancellation and dispatch intent compete atomically in the owning journal.
      current.phase =
        authorizationFailed || ledger.cancelled.has(operationKey) ? "cancelled" : "dispatching";
      return structuredClone(current);
    });
    if (attempt.phase === "cancelled") return finishContextAccountingAttempt(attempt, services);
    const completion = validateContextAccountingCompletion(
      await services.dispatch(input),
      input,
      operationKey,
    );
    const completed = await services.transact(input.payerId, ledger => {
      const current = ledger.attempts.get(operationKey)!;
      if (current.phase !== "dispatching") throw new Error("Attempt phase changed");
      current.completion = completion;
      current.phase = "completed";
      return structuredClone(current);
    });
    return finishContextAccountingAttempt(completed, services);
  } catch {
    // Journal phase retains maximum exposure; no automatic release, debit or provider retry.
    return { state: "pending_reconciliation" as const, operationKey };
  }
}
