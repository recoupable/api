import { describe, it, expect } from "vitest";
import { sumCreditsDeducted } from "@/lib/usage/sumCreditsDeducted";

describe("sumCreditsDeducted", () => {
  it("adds the charge of every row", () => {
    expect(sumCreditsDeducted([{ credits_deducted: 10000 }, { credits_deducted: 51740 }])).toBe(
      61740,
    );
  });

  it("is 0 for no rows", () => {
    expect(sumCreditsDeducted([])).toBe(0);
  });
});
