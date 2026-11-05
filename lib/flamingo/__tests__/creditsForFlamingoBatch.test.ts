import { describe, it, expect } from "vitest";
import { creditsForFlamingoBatch } from "../creditsForFlamingoBatch";
import { FLAMINGO_BASE_CREDITS } from "../creditsForFlamingoCall";

describe("creditsForFlamingoBatch", () => {
  // A batch pays the five-cent base once, however many prompts it carries,
  // plus $0.001166 per second of the whole batch. A credit is a micro-dollar.

  it("charges one base plus the batch's total seconds", () => {
    // 90 × 0.001166 = $0.10494 → 104,940, plus one 50,000 base.
    expect(creditsForFlamingoBatch(90)).toBe(154_940);
    // 30 × 0.001166 = $0.03498 → 34,980 + 50,000.
    expect(creditsForFlamingoBatch(30)).toBe(84_980);
  });

  it("costs far less than one call per prompt for the same seconds", () => {
    // 36 single calls of 2.5 s each would owe 36 bases.
    const perPrompt = 36 * (FLAMINGO_BASE_CREDITS + 2_915);
    expect(creditsForFlamingoBatch(90)).toBeLessThan(perPrompt);
  });

  it("charges exactly the base for zero seconds", () => {
    expect(creditsForFlamingoBatch(0)).toBe(FLAMINGO_BASE_CREDITS);
    expect(FLAMINGO_BASE_CREDITS).toBe(50_000);
  });

  it("charges the base for a negative or non-finite duration rather than throwing", () => {
    expect(creditsForFlamingoBatch(-3)).toBe(50_000);
    expect(creditsForFlamingoBatch(Number.NaN)).toBe(50_000);
    expect(creditsForFlamingoBatch(Number.POSITIVE_INFINITY)).toBe(50_000);
  });
});
