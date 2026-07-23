import type { ReleaseRollup } from "@/lib/catalog/buildReleaseRollups";
import type { ValuationReleaseRow } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Turn per-release rollups into the email's release rows: proportional-share
 * value (mid x streams / totalStreams, so the rows sum to the headline band and
 * never diverge from the funnel) joined with album art by name. Rollups arrive
 * pre-sorted by streams descending (buildReleaseRollups).
 */
export function buildValuationReleaseRows(params: {
  rollups: ReleaseRollup[];
  totalStreams: number;
  bandMid: number;
  artByAlbum: Map<string, string>;
}): ValuationReleaseRow[] {
  const { rollups, totalStreams, bandMid, artByAlbum } = params;
  return rollups.map(rollup => ({
    album: rollup.album,
    artistNames: rollup.artistNames,
    streams: rollup.streams,
    value: totalStreams > 0 ? (bandMid * rollup.streams) / totalStreams : 0,
    artUrl: rollup.album ? (artByAlbum.get(rollup.album.trim().toLowerCase()) ?? null) : null,
  }));
}
