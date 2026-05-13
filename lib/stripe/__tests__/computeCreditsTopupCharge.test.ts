import { describe, it, expect } from "vitest";
import { computeCreditsTopupCharge } from "@/lib/stripe/computeCreditsTopupCharge";

describe("computeCreditsTopupCharge", () => {
  it("grosses up so net (after Stripe US card fee 2.9% + 30¢) covers credits", () => {
    // For 250 credits: gross-up math is ceil((250 + 30) / (1 - 0.029)) = ceil(288.36) = 289¢
    // → fee = 289 - 250 = 39¢, customer charged $2.89, Stripe takes ~38.4¢, business nets ≥ 250¢
    const { feeCents, totalCents } = computeCreditsTopupCharge(250);
    expect(totalCents).toBe(289);
    expect(feeCents).toBe(39);
  });

  it("nets at least credits cents after Stripe's actual fee for a range of sizes", () => {
    for (const credits of [1, 50, 100, 250, 1_000, 10_000, 100_000]) {
      const { totalCents } = computeCreditsTopupCharge(credits);
      const stripeFee = totalCents * 0.029 + 30;
      const net = totalCents - stripeFee;
      // allow 1¢ rounding slack — gross-up rounds up so we never undercollect
      expect(net).toBeGreaterThanOrEqual(credits - 0.5);
    }
  });

  it("totalCents = credits + feeCents", () => {
    for (const credits of [1, 17, 250, 9999]) {
      const { feeCents, totalCents } = computeCreditsTopupCharge(credits);
      expect(totalCents).toBe(credits + feeCents);
    }
  });

  it("rejects non-positive or non-integer credits", () => {
    expect(() => computeCreditsTopupCharge(0)).toThrow(/positive/);
    expect(() => computeCreditsTopupCharge(-5)).toThrow(/positive/);
    expect(() => computeCreditsTopupCharge(12.5)).toThrow(/integer/);
  });
});
