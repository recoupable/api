import { describe, it, expect } from "vitest";
import { computeValuationBand } from "../computeValuationBand";

describe("computeValuationBand", () => {
  it("computes the band from lifetime streams + catalog age (marketing card model)", () => {
    // 100M lifetime Spotify plays, catalog ~10 years old
    const v = computeValuationBand({
      totalStreams: 100_000_000,
      earliestReleaseDate: "2016-06-12",
      now: new Date("2026-06-12"),
    });

    // annual proxy = 100M / 10y = 10M streams/yr
    // spotify gross/yr = 10M x $0.0035 = $35,000
    // total gross band = spotify x (1.25 / 1.40 / 1.60)
    // NLS = gross x 0.85 x 0.75; value = NLS x (10 / 13 / 16)
    expect(v.catalogAgeYears).toBe(10);
    expect(v.valuation.low).toBeCloseTo(35_000 * 1.25 * 0.85 * 0.75 * 10, 0);
    expect(v.valuation.mid).toBeCloseTo(35_000 * 1.4 * 0.85 * 0.75 * 13, 0);
    expect(v.valuation.high).toBeCloseTo(35_000 * 1.6 * 0.85 * 0.75 * 16, 0);
  });

  it("clamps catalog age to at least one year and flags the floor (chat#1969)", () => {
    const v = computeValuationBand({
      totalStreams: 1_000_000,
      earliestReleaseDate: "2026-01-01",
      now: new Date("2026-06-12"),
    });

    expect(v.catalogAgeYears).toBe(1);
    // A ~5-month-old catalog is priced on a full-year floor; callers surface
    // that honestly (the valuation email's caveat line).
    expect(v.ageFlooredToOneYear).toBe(true);
    // age 1y: annual proxy = lifetime
    expect(v.valuation.mid).toBeCloseTo(1_000_000 * 0.0035 * 1.4 * 0.85 * 0.75 * 13, 0);
  });

  it("does not flag the floor for a catalog older than a year", () => {
    const v = computeValuationBand({
      totalStreams: 1_000_000,
      earliestReleaseDate: "2024-06-12",
      now: new Date("2026-06-12"),
    });

    expect(v.catalogAgeYears).toBe(2);
    expect(v.ageFlooredToOneYear).toBe(false);
  });

  it("does not flag the floor when age falls back to the default (no release date)", () => {
    const v = computeValuationBand({
      totalStreams: 1_000_000,
      earliestReleaseDate: null,
      now: new Date("2026-06-12"),
    });

    expect(v.ageFlooredToOneYear).toBe(false);
  });

  it("returns a zero band for zero streams", () => {
    const v = computeValuationBand({
      totalStreams: 0,
      earliestReleaseDate: "2020-01-01",
      now: new Date("2026-06-12"),
    });

    expect(v.valuation).toEqual({ low: 0, mid: 0, high: 0 });
  });

  it("falls back to the 5y default age when the release date is unparseable", () => {
    const v = computeValuationBand({
      totalStreams: 50_000_000,
      earliestReleaseDate: "not-a-date",
      now: new Date("2026-06-12"),
    });

    expect(v.catalogAgeYears).toBe(5);
    expect(v.ageFlooredToOneYear).toBe(false);
    expect(Number.isFinite(v.valuation.mid)).toBe(true);
  });

  it("falls back to the 5y default age when no release date is known", () => {
    const v = computeValuationBand({
      totalStreams: 50_000_000,
      earliestReleaseDate: null,
      now: new Date("2026-06-12"),
    });

    expect(v.catalogAgeYears).toBe(5);
  });
});
