import type { ProxyResult } from "@/lib/research/ProxyResult";
import { buildArtistCatalogQuery } from "@/lib/research/songstats/buildArtistCatalogQuery";
import { buildArtistTopTracksQuery } from "@/lib/research/songstats/buildArtistTopTracksQuery";
import { normalizeArtistTopTracks } from "@/lib/research/songstats/normalizeArtistTopTracks";
import { normalizeArtistTracksCatalogFallback } from "@/lib/research/songstats/normalizeArtistTracksCatalogFallback";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

/**
 * Fetches artist tracks from SongStats top_tracks, falling back to a filtered catalog slice.
 */
export async function fetchArtistTracksFromSongstats(
  artistId: string,
  query?: Record<string, string>,
): Promise<ProxyResult> {
  const topResult = await fetchSongstats(
    "/artists/top_tracks",
    buildArtistTopTracksQuery(artistId, query),
  );

  if (topResult.status === 200) {
    const tracks = normalizeArtistTopTracks(topResult.data, query);
    if (tracks.length > 0) {
      return { status: 200, data: tracks };
    }
  }

  const catalogQuery = buildArtistCatalogQuery(artistId, {
    ...query,
    isPrimary: "true",
    limit: query?.limit ?? String(50),
  });
  const catalogResult = await fetchSongstats("/artists/catalog", catalogQuery);

  if (catalogResult.status !== 200) {
    return topResult.status !== 200 ? topResult : catalogResult;
  }

  return {
    status: 200,
    data: normalizeArtistTracksCatalogFallback(catalogResult.data, query),
  };
}
