import { z } from "zod";
const id = z.string().trim().min(1).max(100);
const credits = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** Fixture-only trusted input: there is deliberately no production policy or enablement default. */
export function validateContextAccountingInput(input: unknown) {
  const parsed = z
    .strictObject({
      mode: z.literal("fixture"),
      billing: z.literal("context_owned"),
      payerId: z.uuid(),
      requestId: id,
      pilotId: id,
      moduleId: id,
      attemptId: id,
      pricingVersion: id,
      maximumCredits: credits,
      requestCeiling: credits,
      pilotCeiling: credits,
    })
    .parse(input);
  return { ...parsed, payerId: parsed.payerId.toLowerCase() };
}
