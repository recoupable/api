export interface GetColdStartAccountIdsParams {
  /** Accounts with a sent welcome email in the sweep window. */
  welcomedAccountIds: string[];
  /** Accounts that have at least one rostered artist. */
  rosteredAccountIds: string[];
  /** Accounts already nudged, from the dedupe marker in `email_send_log`. */
  alreadyNudgedAccountIds: string[];
}

/**
 * Which welcomed accounts are still cold-start: emailed a five-step onboarding
 * path, but with no artist on the roster (chat#1889).
 *
 * Two thirds of the first welcome-email cohort landed here — the welcome fires
 * on account creation whether or not a valuation preceded it, so the email
 * promises a roster and a valuation those accounts do not have.
 *
 * Pure so the selection rule is testable without the sweep's three reads.
 */
export function getColdStartAccountIds({
  welcomedAccountIds,
  rosteredAccountIds,
  alreadyNudgedAccountIds,
}: GetColdStartAccountIdsParams): string[] {
  const rostered = new Set(rosteredAccountIds);
  const nudged = new Set(alreadyNudgedAccountIds);

  return [...new Set(welcomedAccountIds)].filter(
    (accountId) => !rostered.has(accountId) && !nudged.has(accountId),
  );
}
