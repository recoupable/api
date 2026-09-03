import { describe, it, expect } from "vitest";
import { creditCostForImages, creditCostForVideoSeconds } from "@/lib/content/creditCostForContent";
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
  // H3 Max is the only video model now — lipsync/OmniHuman is out of scope
  // (recoupable/app#2052, docs#328).
  it("prices per second at the house video rate", () => {
    expect(creditCostForVideoSeconds(10)).toBe(usdToCredits(0.8));
    expect(creditCostForVideoSeconds(5)).toBe(usdToCredits(0.4));
  });

  it("is zero for a non-positive duration", () => {
    expect(creditCostForVideoSeconds(0)).toBe(0);
    expect(creditCostForVideoSeconds(-1)).toBe(0);
  });
});
