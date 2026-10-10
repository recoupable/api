import { expect, it } from "vitest";
import { describeCatalogValuationMethodology } from "../describeCatalogValuationMethodology";
import {
  computeValuationBand,
  VALUATION_MODEL_ASSUMPTIONS,
} from "@/lib/catalog/computeValuationBand";

it("labels the reused valuation as a workspace-private modeled estimate, not observed revenue", () => {
  const estimate = describeCatalogValuationMethodology({
    catalogAgeYears: 4,
    ageFlooredToOneYear: false,
    ageSource: "release_date",
  });
  expect(estimate).toMatchObject({
    methodology: {
      id: "recoup-master-catalog-band",
      version: 1,
      executor: "computeValuationBand",
      reference: "marketing valuation card",
    },
    currency: "USD",
    period: {
      basis: "lifetime_average_annual_run_rate",
      catalogAgeYears: 4,
      ageFlooredToOneYear: false,
      ageSource: "release_date",
      measuredThrough: null,
    },
    source: {
      kind: "existing_catalog_song_measurements",
      provider: "recoup",
      freshness: "unknown",
    },
    revenueBasis: "modeled_estimate",
    observedRevenue: { status: "not_collected" },
    scope: "workspace_private",
    shareable: false,
  });
  expect(estimate.assumptions).toBe(VALUATION_MODEL_ASSUMPTIONS);
});

it("keeps every period field null when nothing was modeled", () => {
  const estimate = describeCatalogValuationMethodology({
    catalogAgeYears: null,
    ageFlooredToOneYear: null,
    ageSource: null,
  });
  expect(estimate.period).toEqual({
    basis: "lifetime_average_annual_run_rate",
    catalogAgeYears: null,
    ageFlooredToOneYear: null,
    ageSource: null,
    measuredThrough: null,
  });
  expect(estimate.revenueBasis).toBe("modeled_estimate");
  expect(estimate.observedRevenue).toEqual({ status: "not_collected" });
});

it("exposes frozen assumptions that reproduce the shared valuation model exactly", () => {
  const a = VALUATION_MODEL_ASSUMPTIONS;
  const totalStreams = 100_000_000;
  const band = computeValuationBand({
    totalStreams,
    earliestReleaseDate: "2016-06-12",
    now: new Date("2026-06-12"),
  });
  const annualGross = (totalStreams / band.catalogAgeYears) * a.spotifyPerStreamUsd;
  const net = (1 - a.distributionFee) * (1 - a.royaltyShare);
  expect(band.valuation.low).toBeCloseTo(
    annualGross * a.grossUpOverSpotify.low * net * a.masterCatalogMultiple.low,
    6,
  );
  expect(band.valuation.mid).toBeCloseTo(
    annualGross * a.grossUpOverSpotify.mid * net * a.masterCatalogMultiple.mid,
    6,
  );
  expect(band.valuation.high).toBeCloseTo(
    annualGross * a.grossUpOverSpotify.high * net * a.masterCatalogMultiple.high,
    6,
  );
  expect(computeValuationBand({ totalStreams, earliestReleaseDate: null }).catalogAgeYears).toBe(
    a.defaultCatalogAgeYears,
  );
  expect(a.minimumCatalogAgeYears).toBe(1);
  expect(Object.isFrozen(a)).toBe(true);
});
