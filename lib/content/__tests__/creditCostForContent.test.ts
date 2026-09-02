import { describe, it, expect } from "vitest";
import {
  creditCostForImages,
  creditCostForVideoSeconds,
} from "@/lib/content/creditCostForContent";
import { usdToCredits } from "@/lib/credits/usdToCredits";

describe("creditCostForImages", () => {
  it("prices per generated image", () => {
    expect(creditCostForImages(1)).toBe(usdToCredits(0.01));
    expect(creditCostForImages(4)).toBe(usdToCredits(0.04));
  });

  it("is zero for a non-positive count", () => {
    expect(creditCostForImages(0)).toBe(0);
    expect(creditCostForImages(-1)).toBe(0);
  });
});

describe("creditCostForVideoSeconds", () => {
  // Lipsync runs OmniHuman, which costs twice the house image-to-video rate.
  it("prices lipsync higher than every other mode", () => {
    expect(creditCostForVideoSeconds(10, "lipsync")).toBe(usdToCredits(1.6));
    expect(creditCostForVideoSeconds(10, "animate")).toBe(usdToCredits(0.8));
    expect(creditCostForVideoSeconds(10, "prompt")).toBe(usdToCredits(0.8));
  });

  it("is zero for a non-positive duration", () => {
    expect(creditCostForVideoSeconds(0, "prompt")).toBe(0);
  });

  it("charges lipsync strictly more than the default mode for the same length", () => {
    expect(creditCostForVideoSeconds(8, "lipsync")).toBeGreaterThan(
      creditCostForVideoSeconds(8, "animate"),
    );
  });
});
