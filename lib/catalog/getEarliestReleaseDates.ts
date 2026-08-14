import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";

/** Spotify's GET /v1/albums caps ids at 20 per request. */
const SPOTIFY_ALBUM_BATCH = 20;

/** Requests in flight at once — fast enough for a list page, polite to the rate limit. */
const SPOTIFY_CONCURRENCY = 8;

/** Catalog ids per snapshots query, so one `.in()` can't outgrow PostgREST's URL limit. */
const CATALOG_ID_BATCH = 50;

/**
 * Earliest Spotify release date per catalog — the catalog-age input to the
 * valuation band, resolved for a whole list in one pass.
 *
 * The single-catalog equivalent, `getCatalogEarliestReleaseDate`, is a snapshots
 * query plus a Spotify round trip **each**; running it per row is what makes a
 * list page slow. Here the album ids come from one snapshots query per 50
 * catalogs, Spotify is asked 20 ids per request with 8 requests in flight, and
 * each catalog then takes the earliest date among its own albums. Measured on a
 * 41-catalog account: 730 deduped album ids, ~3.1s warm — against 11.8s when the
 * batches were walked sequentially (chat#1943).
 *
 * Best-effort throughout, like the single-catalog path: a catalog with no
 * snapshot or no album ids is simply absent from the result, and a failed
 * Spotify batch costs only its own albums their date — the callers fall back to
 * the model's default age rather than losing the valuation.
 *
 * @param catalogIds - Catalogs to resolve release dates for
 * @returns catalog id → earliest release date (ISO, Spotify precision)
 */
export async function getEarliestReleaseDates(catalogIds: string[]): Promise<Map<string, string>> {
  const earliest = new Map<string, string>();
  if (!catalogIds.length) return earliest;

  // One .in() with every catalog id would eventually exceed PostgREST's URL
  // limit, and selectPlaycountSnapshots reports that failure as [] — which here
  // would silently mean "no release dates", i.e. every band computed at the
  // default age.
  const catalogChunks = chunk(catalogIds, CATALOG_ID_BATCH);
  const snapshots = (
    await Promise.all(catalogChunks.map(catalogs => selectPlaycountSnapshots({ catalogs })))
  ).flat();

  const albumIdsByCatalog = new Map<string, string[]>();
  for (const snapshot of snapshots) {
    // selectPlaycountSnapshots is newest-first, so the first snapshot carrying
    // album ids is the catalog's most recent run — the one the single-catalog
    // path reads too.
    if (!snapshot.catalog || albumIdsByCatalog.has(snapshot.catalog)) continue;
    if (snapshot.album_ids?.length) albumIdsByCatalog.set(snapshot.catalog, snapshot.album_ids);
  }

  const albumIds = [...new Set([...albumIdsByCatalog.values()].flat())];
  if (!albumIds.length) return earliest;

  const { access_token } = await generateAccessToken();
  if (!access_token) return earliest;

  // getAlbums batches internally but walks its batches sequentially, so the
  // chunking has to happen here for the requests to overlap.
  const releaseDateById = new Map<string, string>();
  const albumChunks = chunk(albumIds, SPOTIFY_ALBUM_BATCH);
  for (let i = 0; i < albumChunks.length; i += SPOTIFY_CONCURRENCY) {
    const wave = await Promise.all(
      albumChunks
        .slice(i, i + SPOTIFY_CONCURRENCY)
        .map(ids => getAlbums({ ids, accessToken: access_token })),
    );
    for (const { albums } of wave) {
      for (const album of albums ?? []) {
        if (album.release_date) releaseDateById.set(album.id, album.release_date);
      }
    }
  }
  if (!releaseDateById.size) return earliest;

  for (const [catalogId, ids] of albumIdsByCatalog) {
    const dates = ids
      .map(id => releaseDateById.get(id))
      .filter((date): date is string => Boolean(date))
      .sort();
    if (dates[0]) earliest.set(catalogId, dates[0]);
  }

  return earliest;
}

/**
 * Splits a list into fixed-size chunks.
 *
 * @param items - The list to split
 * @param size - Maximum chunk length
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
