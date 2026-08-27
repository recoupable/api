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

  it("rounds to the nearest unit, and accepts amounts String() would print in exponent notation", () => {
    // The unit is the precision: a residue below it rounds to the nearest
    // micro-dollar rather than being carried, and 7e-7 dollars still parses.
    expect(usdToCredits(0.1234567)).toBe(123_457);
    expect(usdToCredits(0.0000007)).toBe(1);
  });

  it("charges at least one ledger unit, even for a zero or sub-unit cost", () => {
    // A request that reached a model is never free: the minimum is one
    // micro-dollar.
    expect(usdToCredits(0)).toBe(1);
    expect(usdToCredits(0.0000001)).toBe(1);
  });
});
