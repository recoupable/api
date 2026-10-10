/** The hold may or may not exist. Replay with the same key; never start paid work on it. */
export class CreditReservationNeedsReconciliation extends Error {
  constructor(cause?: unknown) {
    super("Credit reservation needs reconciliation; retain the same operation key", { cause });
    this.name = "CreditReservationNeedsReconciliation";
  }
}
