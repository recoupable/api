import { createHash } from "node:crypto";
import type { ContextAccountingInput } from "./types";
/** Identity excludes prices: changed terms on the same attempt must conflict, not mint another debit. */
export function getContextAccountingKey(input: ContextAccountingInput) {
  return (
    "context-attempt-v1-" +
    createHash("sha256")
      .update(
        JSON.stringify([
          input.payerId,
          input.requestId,
          input.pilotId,
          input.moduleId,
          input.attemptId,
        ]),
      )
      .digest("hex")
  );
}
