import { validateContextAccountingInput } from "./validateContextAccountingInput";
import { getContextAccountingKey } from "./getContextAccountingKey";
import { finishContextAccountingAttempt } from "./finishContextAccountingAttempt";
import type { ContextAccountingServices } from "./types";
/** Only known completed/cancelled work can reconcile; provider-unknown work stays held. */
export async function reconcileContextAccountingAttempt(
  raw: unknown,
  services: ContextAccountingServices,
) {
  const input = validateContextAccountingInput(raw);
  await services.authorize(input);
  const operationKey = getContextAccountingKey(input);
  const attempt = await services.transact(input.payerId, ledger => {
    const current = ledger.attempts.get(operationKey);
    if (!current || JSON.stringify(current.input) !== JSON.stringify(input))
      throw new Error("Attempt unavailable or changed");
    return structuredClone(current);
  });
  if (["settled", "released", "insufficient", "reused"].includes(attempt.phase))
    return {
      state: attempt.phase,
      operationKey,
      completion: attempt.completion,
      ...(attempt.phase === "reused"
        ? { resultId: attempt.reuseResultId, customerCredits: 0 }
        : {}),
    };
  return finishContextAccountingAttempt(attempt, services);
}
