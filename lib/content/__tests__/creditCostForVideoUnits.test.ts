import { describe, it, expect } from "vitest";
import { creditCostForVideoUnits } from "@/lib/content/creditCostForVideoUnits";
import { usdToCredits } from "@/lib/credits/usdToCredits";

describe("creditCostForVideoUnits", () => {
  // Standing (post-promo) rate, matching the 480p-equivalent $/s: a 5s/768P
  // request bills 8 units, so 8 * $0.05 = $0.40, not duration * $0.08.
  it("prices per billable unit at the standing 480p-equivalent rate", () => {
    expect(creditCostForVideoUnits(8)).toBe(usdToCredits(0.4));
    expect(creditCostForVideoUnits(5)).toBe(usdToCredits(0.25));
  });

  it("is zero for a non-positive unit count", () => {
    expect(creditCostForVideoUnits(0)).toBe(0);
    expect(creditCostForVideoUnits(-1)).toBe(0);
  });
});
