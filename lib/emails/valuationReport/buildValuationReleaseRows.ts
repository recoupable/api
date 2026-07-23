import type { ReleaseRollup } from "@/lib/catalog/buildReleaseRollups";
import type { SpotifyAlbum } from "@/lib/spotify/getAlbums";
import type { ValuationReleaseRow } from "./renderValuationReportHtml";

/**
 * Map each album name (trimmed, lowercased) to its smallest cover-art URL from
 * a Spotify /v1/albums response. Spotify returns images largest-first, so the
 * last entry is the ~64px thumbnail best suited to an email row.
 */
export function buildAlbumArtMap(albums: SpotifyAlbum[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const album of albums ?? []) {
    const name = album?.name?.trim().toLowerCase();
    const images = album?.images ?? [];
    const url = images[images.length - 1]?.url;
    if (name && url && !map.has(name)) map.set(name, url);
  }
  return map;
}

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
