import { describe, it, expect } from "vitest";
import { creditsForFlamingoCall, FLAMINGO_BASE_CREDITS } from "../creditsForFlamingoCall";

describe("creditsForFlamingoCall", () => {
  // The price is a one-cent base per model call plus twice what the call cost
  // us on Modal. Modal reports the cost of the call (`cost_usd`, its live
  // A100 rate × the seconds it measured); a credit is a micro-dollar, so the
  // base is 10,000 credits.
  it("charges the base plus 2x the cost Modal reported", () => {
    // $0.01749 of compute → $0.03498 → 34,980 credits, plus the 10,000 base.
    expect(creditsForFlamingoCall({ elapsedSeconds: 30, costUsd: 0.01749 })).toBe(44_980);
    expect(FLAMINGO_BASE_CREDITS).toBe(10_000);
  });

  it("uses Modal's figure, not the seconds, when both are present", () => {
    // If Modal's rate moved to $3.00/h, a 30 s call costs $0.025 → 2x = 50,000.
    expect(creditsForFlamingoCall({ elapsedSeconds: 30, costUsd: 0.025 })).toBe(60_000);
  });

  it("falls back to the pinned A100 rate × seconds when cost_usd is absent", () => {
    // 30 × 2 × 0.000583 = $0.03498 → 34,980 + 10,000. Same answer as Modal's
    // own figure while Modal's price list is unchanged.
    expect(creditsForFlamingoCall({ elapsedSeconds: 30 })).toBe(44_980);
    expect(creditsForFlamingoCall({ elapsedSeconds: 2 })).toBe(12_332);
  });

  it("falls back to seconds when cost_usd is not a usable number", () => {
    expect(creditsForFlamingoCall({ elapsedSeconds: 30, costUsd: Number.NaN })).toBe(44_980);
    expect(creditsForFlamingoCall({ elapsedSeconds: 30, costUsd: -1 })).toBe(44_980);
  });

  it("charges exactly the base for a zero, negative, or non-finite duration with no cost", () => {
    expect(creditsForFlamingoCall({ elapsedSeconds: 0 })).toBe(10_000);
    expect(creditsForFlamingoCall({ elapsedSeconds: -1 })).toBe(10_000);
    expect(creditsForFlamingoCall({ elapsedSeconds: Number.NaN })).toBe(10_000);
  });
});
