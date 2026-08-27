import { describe, it, expect } from "vitest";
import { usdToCredits } from "../usdToCredits";
import { CREDIT_DECIMALS } from "../creditDecimals";

describe("usdToCredits", () => {
  it("is the USDC unit: six decimals, a million per dollar", () => {
    expect(CREDIT_DECIMALS).toBe(6);
    expect(usdToCredits(1)).toBe(1_000_000);
    expect(usdToCredits(92.44)).toBe(92_440_000);
  });

  it("converts fractional dollars exactly, without floating-point drift", () => {
    // 0.12 * 1e6 is 119999.99999999999 in IEEE-754; the ledger must see 120000.
    expect(usdToCredits(0.12)).toBe(120_000);
    expect(usdToCredits(0.002 * 25.87)).toBe(51_740);
  });

  it("never rounds up: a fraction of the ledger unit is absorbed, not charged", () => {
    // recoupable/app#2000, owner decision 2026-08-27: pass provider prices
    // through; the unit is the precision and any residue below it is ours.
    expect(usdToCredits(0.0000019)).toBe(1);
    expect(usdToCredits(0.1234567)).toBe(123_456);
  });

  it("charges at least one ledger unit, even for a zero or sub-unit cost", () => {
    // A request that reached a model is never free: the minimum is one
    // micro-dollar.
    expect(usdToCredits(0)).toBe(1);
    expect(usdToCredits(0.0000001)).toBe(1);
  });
});
