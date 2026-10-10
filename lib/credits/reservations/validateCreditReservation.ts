import { z } from "zod";

export const creditReservationSchema = z.strictObject({
  accountId: z.uuid(),
  operationKey: z
    .string()
    .min(1)
    .max(200)
    .refine(value => value.trim().length > 0),
  creditsToReserve: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type CreditReservationInput = z.infer<typeof creditReservationSchema>;

/** Validate a trusted server hold request without changing its operation identity. */
export function validateCreditReservation(input: CreditReservationInput): CreditReservationInput {
  return creditReservationSchema.parse(input);
}
