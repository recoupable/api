import { describe, it, expect } from "vitest";
import { creditsToCents } from "@/lib/billing/creditsToCents";

describe("creditsToCents", () => {
  it("converts credit micro-dollars to whole cents, flooring partial cents", () => {
    expect(creditsToCents(10_000)).toBe(1);
    expect(creditsToCents(100_000_000)).toBe(10000);
    expect(creditsToCents(19_999)).toBe(1);
    expect(creditsToCents(0)).toBe(0);
  });

  it("passes null through", () => {
    expect(creditsToCents(null)).toBeNull();
  });
});
