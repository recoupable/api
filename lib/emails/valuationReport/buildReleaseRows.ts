import { buildAlbumArtMap } from "@/lib/emails/valuationReport/buildAlbumArtMap";
import { buildValuationReleaseRows } from "@/lib/emails/valuationReport/buildValuationReleaseRows";
import { selectCatalogMeasurementsPage } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsPage";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { buildReleaseRollups } from "@/lib/catalog/buildReleaseRollups";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

// One page is enough for the report: valuation-claimed catalogs are well under
// this, and the release table only needs the measured tracks.
const MEASUREMENTS_LIMIT = 1000;

/**
 * Gather the per-release table (album, streams, proportional value, art) for a
 * valued catalog. Best-effort: any read/Spotify failure returns [] so the email
 * still sends with the headline band, just without the breakdown.
 */
export async function buildReleaseRows(
  catalogId: string,
  albumIds: string[],
  totalStreams: number,
  bandMid: number,
): Promise<ValuationReportEmailParams["releases"]> {
  try {
    const [{ songs }, measurements, tokenResult] = await Promise.all([
      selectCatalogSongsWithArtists({ catalogId }),
      selectCatalogMeasurementsPage({ catalogId, page: 1, limit: MEASUREMENTS_LIMIT }),
      generateAccessToken(),
    ]);

    const rollups = buildReleaseRollups(songs, measurements ?? []);

    let artByAlbum = new Map<string, string>();
    if (albumIds.length > 0 && tokenResult.access_token) {
      const { albums } = await getAlbums({ ids: albumIds, accessToken: tokenResult.access_token });
      if (albums) artByAlbum = buildAlbumArtMap(albums);
    }

    return buildValuationReleaseRows({ rollups, totalStreams, bandMid, artByAlbum });
  } catch (error) {
    console.error(`Valuation email release-table build failed for catalog ${catalogId}:`, error);
    return [];
  }
}
