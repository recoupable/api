/**
 * The moment a granted balance stops being guaranteed: one month after the
 * grant, which is when `checkAndResetCredits` becomes eligible to overwrite the
 * row with the plan total on the next balance read.
 *
 * Month arithmetic is clamped to the last day of the target month, so a grant
 * on Jan 31 expires Feb 28 rather than overflowing to Mar 3. The naive
 * `setMonth(+1)` is *not* the inverse of the reset's `setMonth(-1)` — day
 * clamping makes the two boundaries diverge, and for month-end grants the
 * overflow lands *after* the reset actually fires (a Jan 31 grant reports Mar 3
 * but is reset around Mar 2). Since the contract calls this "the point after
 * which the balance is no longer guaranteed", erring late is the one direction
 * that actively misleads an admin, so the clamp keeps the reported expiry at or
 * before the real one.
 *
 * UTC accessors throughout, so the result does not shift with the host's
 * timezone.
 *
 * @param grantedAt - When the grant was recorded (ISO string).
 * @returns The expiry as an ISO string.
 */
export function getGrantExpiresAt(grantedAt: string): string {
  const granted = new Date(grantedAt);
  const expiresAt = new Date(granted);

  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);

  // A changed day-of-month means the target month was too short and the date
  // overflowed into the following one; setUTCDate(0) walks back to the last day
  // of the intended month.
  if (expiresAt.getUTCDate() !== granted.getUTCDate()) {
    expiresAt.setUTCDate(0);
  }

  return expiresAt.toISOString();
}
