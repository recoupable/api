/**
 * The database rejected this call and rolled it back, so it wrote nothing. Never start
 * paid work on it, and do not replay it unchanged expecting a different answer. `reason`
 * is the fixed database message (for example a released or settled hold, a settlement
 * above the hold, an identity conflict, or an unavailable or ambiguous wallet).
 */
export class CreditReservationRejected extends Error {
  readonly reason: string;

  constructor(reason: string, cause?: unknown) {
    super("Credit reservation request was rejected; nothing was written", { cause });
    this.name = "CreditReservationRejected";
    this.reason = reason;
  }
}
