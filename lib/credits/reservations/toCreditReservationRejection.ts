import { CreditReservationRejected } from "./CreditReservationRejected";

/** SQLSTATE the reservation and charge functions use for every rejection they raise. */
const DEFINITE_REJECTION = "22023";

/**
 * A returned database error with SQLSTATE 22023 was raised inside the RPC transaction,
 * which rolled back, so that call definitely wrote nothing. Any other error, a thrown
 * transport failure or an invalid receipt stays uncertain and needs reconciliation.
 */
export function toCreditReservationRejection(error: unknown): CreditReservationRejected | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code !== DEFINITE_REJECTION || typeof message !== "string") return null;
  return new CreditReservationRejected(message, error);
}
