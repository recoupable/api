import { describe, it, expect } from "vitest";
import { CREDITS_PER_USD, usdToCredits, creditsToUsd } from "../creditUnit";

describe("credit unit", () => {
  it("is a cent today", () => {
    expect(CREDITS_PER_USD).toBe(100);
  });

  it("converts dollars to credits", () => {
    expect(usdToCredits(1)).toBe(CREDITS_PER_USD);
    expect(usdToCredits(0.12)).toBe(12);
  });

  it("never charges zero for work that cost money", () => {
    // A fraction of the smallest unit still represents real provider spend.
    expect(usdToCredits(0.000001)).toBe(1);
  });

  it("charges at least one credit even for a zero cost", () => {
    // Existing chat behaviour, preserved: a request that reached a model is
    // chargeable even when the gateway reports no cost. Returning zero would
    // make an unpriced model free.
    expect(usdToCredits(0)).toBe(1);
  });

  it("round-trips a whole-unit amount", () => {
    expect(creditsToUsd(usdToCredits(4.12))).toBeCloseTo(4.12, 10);
  });

  it("keeps the two directions consistent at the unit boundary", () => {
    // Whatever the unit is, one dollar must be CREDITS_PER_USD credits and
    // CREDITS_PER_USD credits must be one dollar. A change to the constant
    // that breaks this breaks billing in both directions at once.
    expect(creditsToUsd(CREDITS_PER_USD)).toBe(1);
  });
});
