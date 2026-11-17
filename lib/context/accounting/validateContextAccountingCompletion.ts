import { z } from "zod";
import { validateCreditCharge } from "@/lib/credits/charges/validateCreditCharge";
import type { ContextAccountingInput } from "./types";
/** Validate provider facts separately from the existing customer charge event. */
export function validateContextAccountingCompletion(
  raw: unknown,
  input: ContextAccountingInput,
  operationKey: string,
) {
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
    .parse(raw);
  // Reuse the existing strict usage-event validator. No attribution fields are added to it.
  const charge = validateCreditCharge({
    accountId: input.payerId,
    operationKey,
    creditsToDeduct: completion.customerCredits || 1,
    event: completion.event,
  });
  return { ...completion, providerExpense: completion.providerExpense, event: charge.event };
}
