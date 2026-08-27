import { describe, it, expect } from "vitest";
import { creditCostForDuration } from "../creditCostForDuration";

describe("creditCostForDuration", () => {
  // fal charges $0.002 per second and a credit is a micro-dollar, so a second
  // is exactly 2,000 credits: the provider's rate with no markup.
  it("charges fal's own rate for a 60 second song", () => {
    expect(creditCostForDuration(60)).toBe(120_000);
  });

  it("scales linearly with no markup at all", () => {
    expect(creditCostForDuration(10)).toBe(20_000);
    expect(creditCostForDuration(30)).toBe(60_000);
    expect(creditCostForDuration(120)).toBe(240_000);
    expect(creditCostForDuration(300)).toBe(600_000);
  });

  it("applies no floor, so a short song is charged what it costs", () => {
    // The old 15-cent floor made a 10 second song $0.15 against $0.02 of
    // cost, 7.5x, which contradicts pass-through pricing outright.
    expect(creditCostForDuration(10)).toBe(20_000);
  });

  it("prices fractional seconds exactly, since the unit is finer than the rate", () => {
    expect(creditCostForDuration(61)).toBe(122_000);
    expect(creditCostForDuration(60.5)).toBe(121_000);
    expect(creditCostForDuration(25.87)).toBe(51_740);
  });

  it("never charges zero for a real generation", () => {
    expect(creditCostForDuration(0.1)).toBe(200);
  });

  it("charges nothing when nothing was generated", () => {
    expect(creditCostForDuration(0)).toBe(0);
  });
});
