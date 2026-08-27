import { describe, it, expect } from "vitest";
import { creditsToUsd } from "../creditsToUsd";
import { usdToCredits } from "../usdToCredits";

describe("creditsToUsd", () => {
  it("keeps the two directions consistent at the unit boundary", () => {
    expect(creditsToUsd(1_000_000)).toBe(1);
    expect(creditsToUsd(92_440_000)).toBe(92.44);
    expect(creditsToUsd(usdToCredits(4.12))).toBe(4.12);
  });

  it("carries sub-cent amounts", () => {
    expect(creditsToUsd(51_740)).toBe(0.05174);
  });
});
