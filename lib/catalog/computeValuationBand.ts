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
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

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
}): { valuation: ValuationBand; catalogAgeYears: number } {
  const now = params.now ?? new Date();

  let catalogAgeYears = DEFAULT_AGE_YEARS;
  if (params.earliestReleaseDate) {
    const ageMs = now.getTime() - new Date(params.earliestReleaseDate).getTime();
    catalogAgeYears = Math.max(1, Math.round(ageMs / YEAR_MS));
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
  };
}
