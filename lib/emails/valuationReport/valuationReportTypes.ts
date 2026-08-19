/**
 * Shared shapes for the valuation-report email (recoupable/chat#1867, enriched
 * per chat#1881). Kept in their own module so the per-section render helpers and
 * the top-level renderer can import them without a circular dependency.
 */

export type ValuationReleaseRow = {
  album: string | null;
  artistNames: string[];
  streams: number;
  /** Proportional share of the band's central value (streams / totalStreams x mid). */
  value: number;
  artUrl: string | null;
};

// The numbers are required so an empty "valuation" email is unrepresentable
// at the type level (chat#1969).
export type ValuationReportEmailParams = {
  catalogName: string | null;
  deepLinkUrl: string;
  albumCount: number;
  artist?: { name: string | null; imageUrl: string | null; followers: number | null };
  valuation: { low: number; mid: number; high: number };
  totalStreams: number;
  measuredSongCount: number;
  releaseCount?: number;
  catalogAgeYears: number;
  /** True when the model priced a sub-year catalog on its one-year floor. */
  ageFlooredToOneYear: boolean;
  releases?: ValuationReleaseRow[];
};
