import { describe, it, expect } from "vitest";
import { centsToCredits } from "@/lib/billing/centsToCredits";

describe("centsToCredits", () => {
  it("converts cents to credit micro-dollars (1 cent = 10,000 credits)", () => {
    expect(centsToCredits(1)).toBe(10_000);
    expect(centsToCredits(10000)).toBe(100_000_000);
    expect(centsToCredits(0)).toBe(0);
  });
});
