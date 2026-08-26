import { describe, it, expect } from "vitest";
import { creditCostForDuration } from "../creditCostForDuration";

describe("creditCostForDuration", () => {
  // fal charges $0.002 per second and 1 credit is $0.01, so 0.2 credits per
  // second is fal's rate exactly. Durations divisible by 5 price to the cent.
  it("charges fal's own rate for a 60 second song", () => {
    expect(creditCostForDuration(60)).toBe(12);
  });

  it("prices durations divisible by five with no markup at all", () => {
    expect(creditCostForDuration(10)).toBe(2);
    expect(creditCostForDuration(30)).toBe(6);
    expect(creditCostForDuration(120)).toBe(24);
    expect(creditCostForDuration(300)).toBe(60);
  });

  it("applies no floor, so a short song is charged what it costs", () => {
    // The old 15-credit floor made a 10 second song $0.15 against $0.02 of
    // cost, 7.5x, which contradicts pass-through pricing outright.
    expect(creditCostForDuration(10)).toBeLessThan(15);
  });

  it("rounds a part-credit up, never down", () => {
    // The ledger is integer cents, so a cent buys exactly five seconds and
    // anything between rounds. Up, so we are never under cost.
    expect(creditCostForDuration(61)).toBe(13);
    expect(creditCostForDuration(60.5)).toBe(13);
    expect(creditCostForDuration(11)).toBe(3);
  });

  it("never charges zero for a real generation", () => {
    expect(creditCostForDuration(0.1)).toBe(1);
  });
});
