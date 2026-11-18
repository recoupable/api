import { getContextAccountingKey } from "./getContextAccountingKey";
import type {
  ContextAccountingInput,
  ContextAccountingLedger,
  ContextAccountingAttempt,
} from "./types";
/** Runs only inside the payer transaction; ceilings are allocation counters, never another wallet. */
export function admitContextAccountingAttempt(
  input: ContextAccountingInput,
  ledger: ContextAccountingLedger,
  reuseResultId?: string,
) {
  const key = getContextAccountingKey(input);
  const prior = ledger.attempts.get(key);
  if (prior) {
    if (JSON.stringify(prior.input) !== JSON.stringify(input))
      throw new Error("Attempt terms changed");
    return { created: false, attempt: structuredClone(prior) };
  }
  const requestPolicy = ledger.requestPolicies.get(input.requestId);
  const pilotPolicy = ledger.pilotPolicies.get(input.pilotId);
  if (
    (requestPolicy &&
      (requestPolicy.pilotId !== input.pilotId ||
        requestPolicy.ceiling !== input.requestCeiling)) ||
    (pilotPolicy !== undefined && pilotPolicy !== input.pilotCeiling)
  )
    throw new Error("Budget terms changed");
  let request = 0n,
    pilot = 0n;
  for (const attempt of ledger.attempts.values()) {
    const amount = ["released", "insufficient", "reused"].includes(attempt.phase)
      ? 0
      : attempt.phase === "settled"
        ? attempt.completion!.customerCredits
        : attempt.input.maximumCredits;
    if (attempt.input.requestId === input.requestId) request += BigInt(amount);
    if (attempt.input.pilotId === input.pilotId) pilot += BigInt(amount);
  }
  if (
    !reuseResultId &&
    (request + BigInt(input.maximumCredits) > BigInt(input.requestCeiling) ||
      pilot + BigInt(input.maximumCredits) > BigInt(input.pilotCeiling))
  )
    return { created: false, attempt: null };
  ledger.requestPolicies.set(input.requestId, {
    pilotId: input.pilotId,
    ceiling: input.requestCeiling,
  });
  ledger.pilotPolicies.set(input.pilotId, input.pilotCeiling);
  const attempt: ContextAccountingAttempt = {
    input: structuredClone(input),
    operationKey: key,
    phase: reuseResultId ? "reused" : "admitted",
    ...(reuseResultId ? { reuseResultId } : {}),
  };
  ledger.attempts.set(key, attempt);
  return { created: true, attempt: structuredClone(attempt) };
}
