/**
 * The moment a granted balance stops being guaranteed: one month after the
 * grant, which is when `checkAndResetCredits` becomes eligible to overwrite
 * the row with the plan total on the next balance read.
 *
 * Deliberately mirrors that function's `setMonth(getMonth() - 1)` arithmetic,
 * overflow included, so the date returned to an admin agrees with the check
 * that will actually fire. A grant on Jan 31 expires Mar 3, not Feb 28.
 *
 * @param grantedAt - When the grant was recorded (ISO string).
 * @returns The expiry as an ISO string.
 */
export function getGrantExpiresAt(grantedAt: string): string {
  const expiresAt = new Date(grantedAt);
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  return expiresAt.toISOString();
}
