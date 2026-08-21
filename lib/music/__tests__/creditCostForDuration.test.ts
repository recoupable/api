import { describe, it, expect } from "vitest";
import { creditCostForDuration } from "../creditCostForDuration";

describe("creditCostForDuration", () => {
  it("charges the documented 30 credits for the default 60 second song", () => {
    expect(creditCostForDuration(60)).toBe(30);
  });

  it("applies a floor so a very short song is never near-free", () => {
    expect(creditCostForDuration(10)).toBe(15);
    expect(creditCostForDuration(20)).toBe(15);
  });

  it("scales with duration past the floor", () => {
    expect(creditCostForDuration(120)).toBe(60);
    expect(creditCostForDuration(300)).toBe(150);
  });

  it("rounds a fractional duration up, never down", () => {
    expect(creditCostForDuration(61)).toBe(31);
    expect(creditCostForDuration(60.5)).toBe(31);
  });
});
