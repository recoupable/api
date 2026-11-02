export type ValuationBand = { low: number; mid: number; high: number };

// Mirrors the marketing valuation card's model exactly
// (marketing/lib/valuation/computeCatalogValuation.ts + nlsBandFromSpotifyGross.ts)
// so marketing and chat can never drift. Change constants in both places or not at all.
const SPOTIFY_PER_STREAM_USD = 0.0035;
const GROSS_UP = { low: 1.25, mid: 1.4, high: 1.6 };
const DISTRIBUTION_FEE = 0.15;
const ROYALTY_SHARE = 0.25;
const MULTIPLE = { low: 10, mid: 13, high: 16 };
const DEFAULT_AGE_YEARS = 5;
const MIN_AGE_YEARS = 1;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Read-only description of the constants above, for callers that must label
 * an estimate with its assumptions (Context Engine evidence). Every field reads
 * the same constant the band uses, so it cannot drift from the model; it is
 * not a second place to tune them.
 */
export const VALUATION_MODEL_ASSUMPTIONS = Object.freeze({
  spotifyPerStreamUsd: SPOTIFY_PER_STREAM_USD,
  grossUpOverSpotify: Object.freeze({ ...GROSS_UP }),
  distributionFee: DISTRIBUTION_FEE,
  royaltyShare: ROYALTY_SHARE,
  masterCatalogMultiple: Object.freeze({ ...MULTIPLE }),
  defaultCatalogAgeYears: DEFAULT_AGE_YEARS,
  minimumCatalogAgeYears: MIN_AGE_YEARS,
});

/**
 * Derive a catalog valuation band from lifetime Spotify play counts — the same
 * model as the recoupable.dev valuation card: annual run-rate via the
 * lifetime-average proxy (all-time streams / catalog age), converted to net
 * label share and multiplied by a 10-16x master-catalog market multiple.
 *
 * @param params.totalStreams - Sum of the latest play counts across the catalog
 * @param params.earliestReleaseDate - Earliest release date (ISO); null falls back to a 5y default age
 * @param params.now - Clock override for tests
 */
export function computeValuationBand(params: {
  totalStreams: number;
  earliestReleaseDate: string | null;
  now?: Date;
}): { valuation: ValuationBand; catalogAgeYears: number; ageFlooredToOneYear: boolean } {
  const now = params.now ?? new Date();

  let catalogAgeYears = DEFAULT_AGE_YEARS;
  let ageFlooredToOneYear = false;
  if (params.earliestReleaseDate) {
    const ageMs = now.getTime() - new Date(params.earliestReleaseDate).getTime();
    // An unparseable date yields NaN, which would poison the whole band —
    // fall back to the default age instead (chat#1969 review).
    if (Number.isFinite(ageMs)) {
      catalogAgeYears = Math.max(MIN_AGE_YEARS, Math.round(ageMs / YEAR_MS));
      // A catalog younger than a year is priced on a full-year run rate;
      // callers surface the floor honestly (chat#1969).
      ageFlooredToOneYear = ageMs < YEAR_MS;
    }
  }

  const annualGross = (params.totalStreams / catalogAgeYears) * SPOTIFY_PER_STREAM_USD;
  const net = (1 - DISTRIBUTION_FEE) * (1 - ROYALTY_SHARE);

  return {
    valuation: {
      low: annualGross * GROSS_UP.low * net * MULTIPLE.low,
      mid: annualGross * GROSS_UP.mid * net * MULTIPLE.mid,
      high: annualGross * GROSS_UP.high * net * MULTIPLE.high,
    },
    catalogAgeYears,
    ageFlooredToOneYear,
  };
}
