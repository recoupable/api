import { describe, it, expect } from "vitest";

import { getGrantExpiresAt } from "../getGrantExpiresAt";

describe("getGrantExpiresAt", () => {
  it("returns one month after the grant", () => {
    expect(getGrantExpiresAt("2026-08-06T23:00:00.000Z")).toBe("2026-09-06T23:00:00.000Z");
  });

  it("rolls across a year boundary", () => {
    expect(getGrantExpiresAt("2026-12-15T10:00:00.000Z")).toBe("2027-01-15T10:00:00.000Z");
  });

  it("overflows a short month the same way the reset check does", () => {
    // checkAndResetCredits compares against `setMonth(getMonth() - 1)`, which
    // has this same JS overflow. Jan 31 + 1 month is Mar 3, not Feb 28 — the
    // expiry has to agree with the reset or the documented date would lie.
    expect(getGrantExpiresAt("2026-01-31T00:00:00.000Z")).toBe("2026-03-03T00:00:00.000Z");
  });
});
