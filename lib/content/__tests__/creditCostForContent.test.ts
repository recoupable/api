import { describe, it, expect } from "vitest";
import {
  creditCostForImageUnits,
  creditCostForVideoUnits,
  estimateVideoUnits,
} from "@/lib/content/creditCostForContent";
import { usdToCredits } from "@/lib/credits/usdToCredits";

describe("creditCostForImageUnits", () => {
  it("prices per generated image — one image is one unit", () => {
    expect(creditCostForImageUnits(1)).toBe(usdToCredits(0.01));
    expect(creditCostForImageUnits(4)).toBe(usdToCredits(0.04));
  });

  it("is zero for a non-positive count", () => {
    expect(creditCostForImageUnits(0)).toBe(0);
    expect(creditCostForImageUnits(-1)).toBe(0);
  });
});

describe("estimateVideoUnits", () => {
  // fal bills 768p at 1.6x the 480p unit rate by scaling output_units, not
  // unit_price — confirmed live: a 5s/768P request billed 8 units
  // (5 * 1.6), at the same $0.0125 unit_price as a 480p request.
  it("scales 768P by 1.6x", () => {
    expect(estimateVideoUnits(5, "768P")).toBeCloseTo(8);
  });

  it("does not scale 480P", () => {
    expect(estimateVideoUnits(5, "480P")).toBe(5);
  });
});

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
