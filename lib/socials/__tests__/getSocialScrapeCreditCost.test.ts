import { describe, it, expect } from "vitest";

import { getSocialScrapeCreditCost } from "../getSocialScrapeCreditCost";

describe("getSocialScrapeCreditCost", () => {
  it("charges the 5-credit base when posts is omitted", () => {
    expect(getSocialScrapeCreditCost(undefined)).toBe(5);
  });

  it("charges 5 + posts when a depth is requested", () => {
    expect(getSocialScrapeCreditCost(1)).toBe(6);
    expect(getSocialScrapeCreditCost(20)).toBe(25);
    expect(getSocialScrapeCreditCost(100)).toBe(105);
  });
});
