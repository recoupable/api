import { z } from "zod";
/** Match the pinned reservation receipt before dispatch or capacity release. */
export function validateContextReservationReceipt(raw: unknown) {
  return z
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
    .parse(raw);
}
