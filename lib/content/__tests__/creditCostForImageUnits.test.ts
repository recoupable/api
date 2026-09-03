import { describe, it, expect } from "vitest";
import { creditCostForImageUnits } from "@/lib/content/creditCostForImageUnits";
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
