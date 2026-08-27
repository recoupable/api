import { describe, it, expect } from "vitest";

import { getSocialScrapeCreditCost } from "../getSocialScrapeCreditCost";

describe("getSocialScrapeCreditCost", () => {
  it("charges the 5-credit base when posts is omitted", () => {
    expect(getSocialScrapeCreditCost(undefined)).toBe(50_000);
  });

  it("charges 5 + posts when a depth is requested", () => {
    expect(getSocialScrapeCreditCost(1)).toBe(60_000);
    expect(getSocialScrapeCreditCost(20)).toBe(250_000);
    expect(getSocialScrapeCreditCost(100)).toBe(1_050_000);
  });
});
