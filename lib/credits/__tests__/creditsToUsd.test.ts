import { describe, it, expect } from "vitest";
import { creditsToUsd } from "../creditsToUsd";
import { usdToCredits } from "../usdToCredits";
import { CREDITS_PER_USD } from "../creditsPerUsd";

describe("creditsToUsd", () => {
  it("keeps the two directions consistent at the unit boundary", () => {
    // Whatever the unit is, one dollar must be CREDITS_PER_USD credits and
    // CREDITS_PER_USD credits must be one dollar.
    expect(creditsToUsd(CREDITS_PER_USD)).toBe(1);
    expect(creditsToUsd(usdToCredits(4.12))).toBeCloseTo(4.12, 10);
  });
});
