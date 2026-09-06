import { describe, it, expect } from "vitest";
import { creditsForFlamingoCall, FLAMINGO_MINIMUM_CREDITS } from "../creditsForFlamingoCall";

describe("creditsForFlamingoCall", () => {
  // Modal bills the A100-40GB at $0.000583/s; we charge twice that, floored
  // at one cent. A credit is a micro-dollar, so the floor is 10,000 credits.
  it("charges the one-cent floor for a warm-container call", () => {
    // 2 × 2.0 × 0.000583 = $0.002332, under the floor.
    expect(creditsForFlamingoCall(2)).toBe(10_000);
    expect(FLAMINGO_MINIMUM_CREDITS).toBe(10_000);
  });

  it("charges 2x compute once a call is long enough to clear the floor", () => {
    // 2 × 30 × 0.000583 = $0.03498 → 34,980 credits.
    expect(creditsForFlamingoCall(30)).toBe(34_980);
    // 2 × 21 × 0.000583 = $0.024486 → 24,486 credits.
    expect(creditsForFlamingoCall(21)).toBe(24_486);
  });

  it("switches from floor to metered exactly where 2x compute crosses a cent", () => {
    // 0.01 / (2 × 0.000583) = 8.5763… s
    expect(creditsForFlamingoCall(8.5)).toBe(10_000);
    expect(creditsForFlamingoCall(8.6)).toBe(10_028);
  });

  it("never charges less than the floor, even for a zero or negative duration", () => {
    expect(creditsForFlamingoCall(0)).toBe(10_000);
    expect(creditsForFlamingoCall(-1)).toBe(10_000);
  });
});

describe("creditsForFlamingoCall — malformed durations", () => {
  it("charges the floor, not a thrown error, when the provider reports a non-finite duration", () => {
    // `isFlamingoGenerateResult` only checks `typeof === "number"`, so NaN and
    // Infinity get through; the call still ran, so the floor is owed.
    expect(creditsForFlamingoCall(Number.NaN)).toBe(10_000);
    expect(creditsForFlamingoCall(Number.POSITIVE_INFINITY)).toBe(10_000);
  });
});
