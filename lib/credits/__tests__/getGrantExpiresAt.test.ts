import { describe, it, expect } from "vitest";

import { getGrantExpiresAt } from "../getGrantExpiresAt";

/**
 * Replicates the refill predicate in `checkAndResetCredits`: a row refills once
 * `lastUpdated < now - 1 month`. Used to assert `expires_at` never promises the
 * balance for longer than the reset actually leaves it alone.
 */
function resetHasFired(grantedAt: string, now: Date): boolean {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 1);
  return new Date(grantedAt) < cutoff;
}

describe("getGrantExpiresAt", () => {
  it("returns one month after the grant", () => {
    expect(getGrantExpiresAt("2026-08-06T23:00:00.000Z")).toBe("2026-09-06T23:00:00.000Z");
  });

  it("rolls across a year boundary", () => {
    expect(getGrantExpiresAt("2026-12-15T10:00:00.000Z")).toBe("2027-01-15T10:00:00.000Z");
  });

  it("clamps to the last day of a short month instead of overflowing into the next", () => {
    // Naive setMonth(+1) gives Mar 3 here. That would overstate the guarantee:
    // the reset fires around Mar 2, so an admin told "Mar 3" would see the
    // balance vanish before the date the API promised.
    expect(getGrantExpiresAt("2026-01-31T00:00:00.000Z")).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(getGrantExpiresAt("2028-01-31T00:00:00.000Z")).toBe("2028-02-29T00:00:00.000Z");
  });

  it("clamps a 31-day month onto a 30-day month", () => {
    expect(getGrantExpiresAt("2026-03-31T12:00:00.000Z")).toBe("2026-04-30T12:00:00.000Z");
  });

  it.each([
    "2026-01-31T00:00:00.000Z",
    "2026-03-31T12:00:00.000Z",
    "2026-05-31T00:00:00.000Z",
    "2026-08-06T23:44:14.000Z",
    "2026-12-15T10:00:00.000Z",
    "2028-01-31T00:00:00.000Z",
  ])("never promises the balance past the moment the reset becomes eligible (%s)", grantedAt => {
    // The contract calls expires_at "the point after which the balance is no
    // longer guaranteed", so reporting a date later than the real reset is the
    // one direction that actively misleads.
    expect(resetHasFired(grantedAt, new Date(getGrantExpiresAt(grantedAt)))).toBe(false);
  });
});
