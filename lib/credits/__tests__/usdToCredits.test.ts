import { describe, it, expect } from "vitest";
import { usdToCredits } from "../usdToCredits";
import { CREDITS_PER_USD } from "../creditsPerUsd";

describe("usdToCredits", () => {
  it("converts whole-unit amounts exactly, without floating-point drift", () => {
    expect(usdToCredits(1)).toBe(CREDITS_PER_USD);
    // 0.12 * 100 is 11.999999999999998 in IEEE-754; the ledger must see 12.
    expect(usdToCredits(0.12)).toBe(12);
    expect(usdToCredits(4.12)).toBe(412);
  });

  it("never rounds up: a fraction of the ledger unit is absorbed, not charged", () => {
    // recoupable/app#2000, owner decision 2026-08-27: pass provider prices
    // through; the ledger unit is the precision and any residue below one
    // unit is ours. Under Math.round this would have been 2.
    expect(usdToCredits(0.0199)).toBe(1);
    expect(usdToCredits(0.0151)).toBe(1);
  });

  it("charges at least one ledger unit, even for a zero or sub-unit cost", () => {
    // A request that reached a model is never free: the minimum is one
    // credit, whatever the unit (one micro-dollar after the rescale).
    expect(usdToCredits(0)).toBe(1);
    expect(usdToCredits(0.000001)).toBe(1);
  });
});
