import { it, expect, vi } from "vitest";
import { collectContextCatalogValuation } from "../collectContextCatalogValuation";
import { VALUATION_MODEL_ASSUMPTIONS } from "@/lib/catalog/computeValuationBand";
const account = "11111111-1111-4111-8111-111111111111",
  catalog = "22222222-2222-4222-8222-222222222222";
it("checks access before reading measurements", async () => {
  const aggregate = vi.fn();
  await expect(
    collectContextCatalogValuation(account, catalog, {
      authorize: async () => {
        throw Error("denied");
      },
      aggregate,
      songCount: async () => 5,
      earliestDate: vi.fn(),
    }),
  ).rejects.toThrow("denied");
  expect(aggregate).not.toHaveBeenCalled();
});
it("keeps missing measurements unknown", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 0, totalStreams: 0 }),
    songCount: async () => 5,
    earliestDate: async () => null,
  });
  expect(r.status).toBe("not_measured");
  expect(r.valuation).toBeNull();
});
it("does not disguise provider failure as an unmeasured catalog", async () => {
  await expect(
    collectContextCatalogValuation(account, catalog, {
      authorize: async () => {},
      aggregate: async () => null,
      songCount: async () => 5,
      earliestDate: async () => null,
    }),
  ).rejects.toThrow("unavailable");
});
it("reuses the valuation model and retains its inputs", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 2, totalStreams: 100000 }),
    songCount: async () => 5,
    earliestDate: async () => null,
  });
  expect(r.valuation?.mid).toBeGreaterThan(0);
  expect(r.inputs.totalStreams).toBe(100000);
  expect(r.scope).toBe("workspace_private");
});

it("reports incomplete measurement coverage and assumed catalog age", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 2, totalStreams: 100 }),
    earliestDate: async () => null,
    songCount: async () => 5,
  });
  expect(r.measurementCoverage).toEqual({
    totalSongCount: 5,
    measuredSongCount: 2,
    unmeasuredSongCount: 3,
    extent: "partial",
  });
  expect(r.ageSource).toBe("model_default");
});
it("rejects inconsistent measurement counts", async () => {
  await expect(
    collectContextCatalogValuation(account, catalog, {
      authorize: async () => {},
      aggregate: async () => ({ measuredSongCount: 3, totalStreams: 100 }),
      earliestDate: async () => null,
      songCount: async () => 2,
    }),
  ).rejects.toThrow("exceeds");
});
it("labels the estimate with currency, period, assumptions, methodology and source, apart from observed revenue", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 2, totalStreams: 100000 }),
    songCount: async () => 2,
    earliestDate: async () => "2020-01-01",
  });
  expect(r.status).toBe("estimated");
  expect(r.estimate).toMatchObject({
    currency: "USD",
    methodology: { id: "recoup-master-catalog-band", executor: "computeValuationBand" },
    period: {
      basis: "lifetime_average_annual_run_rate",
      catalogAgeYears: r.catalogAgeYears,
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
  expect(r.estimate.assumptions).toEqual(VALUATION_MODEL_ASSUMPTIONS);
  expect(r.trace.currency).toBe("USD");
});
it("keeps the estimate label but no modeled period when the catalog is not measured", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 0, totalStreams: 0 }),
    songCount: async () => 5,
    earliestDate: async () => "2020-01-01",
  });
  expect(r.status).toBe("not_measured");
  expect(r.valuation).toBeNull();
  expect(r.estimate.period).toMatchObject({
    catalogAgeYears: null,
    ageFlooredToOneYear: null,
    ageSource: null,
  });
  expect(r.estimate.revenueBasis).toBe("modeled_estimate");
  expect(r.estimate.observedRevenue).toEqual({ status: "not_collected" });
});
