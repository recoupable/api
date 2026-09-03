import { describe, it, expect } from "vitest";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";

describe("estimateVideoUnits", () => {
  // fal bills 768p at 1.6x the 480p unit rate by scaling output_units, not
  // unit_price — confirmed live: a 5s/768P request billed 8 units
  // (5 * 1.6), at the same $0.0125 unit_price as a 480p request.
  it("scales 768P by 1.6x", () => {
    expect(estimateVideoUnits(5, "768P")).toBeCloseTo(8);
  });

  it("does not scale 480P", () => {
    expect(estimateVideoUnits(5, "480P")).toBe(5);
  });
});
