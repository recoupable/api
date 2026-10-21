import { z } from "zod";
import { creditReservationSchema } from "./validateCreditReservation";

const schema = creditReservationSchema.pick({ accountId: true, operationKey: true });
export type CreditReservationReleaseInput = z.infer<typeof schema>;

/** Validate a trusted server release request; it names the hold, never an amount. */
export function validateCreditReservationRelease(
  input: CreditReservationReleaseInput,
): CreditReservationReleaseInput {
  return schema.parse(input);
}
