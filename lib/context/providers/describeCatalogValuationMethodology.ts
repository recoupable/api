import { VALUATION_MODEL_ASSUMPTIONS } from "@/lib/catalog/computeValuationBand";

/**
 * Label a reused Recoup catalog valuation as a modeled, workspace-private
 * estimate. Currency, period, assumptions, methodology and source travel with
 * the number; observed revenue is a separate state that this collector never
 * reads, so it stays `not_collected` rather than zero or unknown.
 *
 * @param period.catalogAgeYears - Modeled catalog age; null when nothing was modeled
 * @param period.ageFlooredToOneYear - Whether a sub-year catalog was priced on a full year
 * @param period.ageSource - Where the age came from; null when nothing was modeled
 */
export function describeCatalogValuationMethodology(period: {
  catalogAgeYears: number | null;
  ageFlooredToOneYear: boolean | null;
  ageSource: "release_date" | "model_default" | null;
}) {
  return {
    methodology: {
      id: "recoup-master-catalog-band",
      version: 1,
      executor: "computeValuationBand",
      reference: "marketing valuation card",
    },
    currency: "USD",
    period: {
      basis: "lifetime_average_annual_run_rate",
      catalogAgeYears: period.catalogAgeYears,
      ageFlooredToOneYear: period.ageFlooredToOneYear,
      ageSource: period.ageSource,
      // The measurement aggregate carries no capture date; unknown stays null.
      measuredThrough: null,
    },
    assumptions: VALUATION_MODEL_ASSUMPTIONS,
    source: {
      kind: "existing_catalog_song_measurements",
      provider: "recoup",
      freshness: "unknown",
    },
    revenueBasis: "modeled_estimate",
    observedRevenue: { status: "not_collected" },
    scope: "workspace_private",
    shareable: false,
  } as const;
}
