import { describe, it, expect } from "vitest";
import { computeValuationBand } from "../computeValuationBand";
import fixture from "./fixtures/valuation-golden.json";

/**
 * Cross-repo divergence guard (recoupable/chat#1850): the valuation model is
 * implemented twice — here and in recoupable/marketing
 * (lib/valuation/computeCatalogValuation.ts). This fixture's twin lives at
 * marketing/lib/valuation/__tests__/fixtures/valuation-golden.json and the two
 * JSON files must stay byte-identical. If this test fails, the api model has
 * drifted from the shared formula: fix the code, or change the fixture in
 * BOTH repos in the same coordinated change.
 */
describe("computeValuationBand golden fixture", () => {
  it.each(fixture.cases)("$name", ({ input, expected }) => {
    const { valuation, catalogAgeYears } = computeValuationBand({
      totalStreams: input.totalStreams,
      earliestReleaseDate: input.earliestReleaseDate,
      now: new Date(input.now),
    });

    expect(catalogAgeYears).toBe(expected.catalogAgeYears);
    // Fixture values are rounded to the cent; assert to within one cent.
    expect(Math.abs(valuation.low - expected.low)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(valuation.mid - expected.mid)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(valuation.high - expected.high)).toBeLessThanOrEqual(0.01);
  });
});
