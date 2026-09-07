import { describe, it, expect } from "vitest";
import { creditsForFlamingoCall, FLAMINGO_BASE_CREDITS } from "../creditsForFlamingoCall";

describe("creditsForFlamingoCall", () => {
  // The price is a five-cent base per model call plus $0.001166 per second of
  // inference (twice Modal's A100-40GB rate, recoupable/app#2061). A credit is a
  // micro-dollar, so the base is 50,000 credits. The base, not the rate, is
  // what pays for container start and scale-down time.

  it("charges the base plus the metered seconds", () => {
    // 30 × 0.001166 = $0.03498 → 34,980, plus the 50,000 base.
    expect(creditsForFlamingoCall(30)).toBe(84_980);
    // 21 × 0.001166 = $0.024486 → 24,486 + 50,000.
    expect(creditsForFlamingoCall(21)).toBe(74_486);
    expect(FLAMINGO_BASE_CREDITS).toBe(50_000);
  });

  it("meters a short warm call on top of the base", () => {
    // 2 × 0.001166 = $0.002332 → 2,332 + 50,000.
    expect(creditsForFlamingoCall(2)).toBe(52_332);
    expect(creditsForFlamingoCall(8.6)).toBe(60_028);
  });

  it("charges exactly the base for a zero or negative duration", () => {
    expect(creditsForFlamingoCall(0)).toBe(50_000);
    expect(creditsForFlamingoCall(-1)).toBe(50_000);
  });

  it("charges the base, not a thrown error, for a non-finite duration", () => {
    // `isFlamingoGenerateResult` only checks `typeof === "number"`.
    expect(creditsForFlamingoCall(Number.NaN)).toBe(50_000);
    expect(creditsForFlamingoCall(Number.POSITIVE_INFINITY)).toBe(50_000);
  });
});
