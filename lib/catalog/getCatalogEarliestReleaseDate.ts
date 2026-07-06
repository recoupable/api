import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";

/**
 * Resolve the earliest Spotify release date for a catalog — the catalog-age
 * input to the valuation band. Release dates aren't persisted, so this reads
 * the album ids off the catalog's newest measurement run (playcount_snapshots)
 * and asks Spotify. Best-effort: any gap (no snapshot, no album ids, token or
 * fetch failure) returns null and the caller falls back to the default age.
 *
 * @param catalogId - The catalog whose source run to inspect
 * @returns Earliest release date (ISO, Spotify precision), or null
 */
export async function getCatalogEarliestReleaseDate(catalogId: string): Promise<string | null> {
  const snapshots = await selectPlaycountSnapshots({ catalog: catalogId });
  const albumIds = snapshots.find(s => s.album_ids && s.album_ids.length > 0)?.album_ids;
  if (!albumIds) return null;

  const { access_token } = await generateAccessToken();
  if (!access_token) return null;

  const { albums } = await getAlbums({ ids: albumIds, accessToken: access_token });
  if (!albums) return null;

  const releaseDates = albums
    .map(a => a.release_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  return releaseDates[0] ?? null;
}
