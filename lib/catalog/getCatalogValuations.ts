import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";
import { computeValuationBand, type ValuationBand } from "./computeValuationBand";

export type CatalogValuationSummary = {
  measuredSongCount: number;
  valuation: ValuationBand | null;
};

/** Spotify's GET /v1/albums caps ids at 20 per request. */
const SPOTIFY_ALBUM_BATCH = 20;

/** Requests in flight at once — fast enough for a list page, polite to the rate limit. */
const SPOTIFY_CONCURRENCY = 8;

/**
 * Value a set of catalogs in one pass — the list-page counterpart of the
 * single-catalog derivation in `getCatalogMeasurementsHandler`, using the same
 * `computeValuationBand` model so a card and the report it opens can never
 * disagree (chat#1943).
 *
 * The naive version of this is `getCatalogEarliestReleaseDate` per catalog,
 * which is a snapshot query plus a Spotify round trip each. Instead the album
 * ids for every catalog are read in **one** snapshots query and fetched from
 * Spotify in **one** batched call, then each catalog takes the earliest release
 * date among its own albums. That leaves the per-catalog aggregate RPC — which
 * has no batched form — as the only work that scales with catalog count, and
 * those run concurrently.
 *
 * Best-effort on the age input, exactly like the single-catalog path: no
 * snapshot, no album ids, or an unavailable Spotify all fall back to the
 * model's default age rather than dropping the valuation.
 *
 * @param catalogIds - Catalogs to value
 * @returns catalog id → `{ measuredSongCount, valuation }`, valuation null when nothing is measured
 */
export async function getCatalogValuations(
  catalogIds: string[],
): Promise<Map<string, CatalogValuationSummary>> {
  const summaries = new Map<string, CatalogValuationSummary>();
  if (!catalogIds.length) return summaries;

  const [aggregates, earliestReleaseDates] = await Promise.all([
    Promise.all(catalogIds.map(catalogId => aggregateWithRetry(catalogId))),
    getEarliestReleaseDates(catalogIds),
  ]);

  catalogIds.forEach((catalogId, index) => {
    const aggregate = aggregates[index];
    const measuredSongCount = aggregate?.measuredSongCount ?? 0;
    if (!measuredSongCount) {
      summaries.set(catalogId, { measuredSongCount: 0, valuation: null });
      return;
    }
    const { valuation } = computeValuationBand({
      totalStreams: aggregate?.totalStreams ?? 0,
      earliestReleaseDate: earliestReleaseDates.get(catalogId) ?? null,
    });
    summaries.set(catalogId, { measuredSongCount, valuation });
  });

  return summaries;
}

/**
 * The measurements aggregate for one catalog, retried once.
 *
 * `selectCatalogMeasurementsAggregate` returns null both when the RPC fails and
 * — by this function's reading — for a catalog with nothing measured, so a
 * transient failure would otherwise be published as "not measured". That is not
 * theoretical: preview testing caught a 9,939-song catalog reporting a null
 * valuation on one run and $88.9M on the next. One retry costs a single extra
 * RPC on the rare failure; a still-failing catalog is logged, because at that
 * point the list cannot tell zero from unknown (chat#1943).
 *
 * @param catalogId - The catalog to aggregate
 */
async function aggregateWithRetry(catalogId: string) {
  const first = await selectCatalogMeasurementsAggregate({ catalogId });
  if (first) return first;

  const second = await selectCatalogMeasurementsAggregate({ catalogId });
  if (!second) {
    console.error(
      `[getCatalogValuations] measurements aggregate failed twice for catalog ${catalogId}; reporting it as unmeasured`,
    );
  }
  return second;
}

/**
 * Earliest Spotify release date per catalog, resolved for the whole set at once.
 *
 * @param catalogIds - Catalogs to resolve release dates for
 */
async function getEarliestReleaseDates(catalogIds: string[]): Promise<Map<string, string>> {
  const earliest = new Map<string, string>();

  const snapshots = await selectPlaycountSnapshots({ catalogs: catalogIds });
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

  // getAlbums batches 20 ids per Spotify request but walks its batches
  // sequentially, which for a real account is the whole cost of this endpoint:
  // 41 catalogs meant 730 album ids — 37 requests back to back, 11.8s. Chunking
  // here and running the chunks concurrently (bounded, so a burst can't trip
  // Spotify's rate limit) is what keeps the list page usable.
  const chunks: string[][] = [];
  for (let i = 0; i < albumIds.length; i += SPOTIFY_ALBUM_BATCH) {
    chunks.push(albumIds.slice(i, i + SPOTIFY_ALBUM_BATCH));
  }

  const releaseDateById = new Map<string, string>();
  for (let i = 0; i < chunks.length; i += SPOTIFY_CONCURRENCY) {
    const wave = await Promise.all(
      chunks
        .slice(i, i + SPOTIFY_CONCURRENCY)
        .map(ids => getAlbums({ ids, accessToken: access_token })),
    );
    for (const { albums } of wave) {
      // A failed chunk costs those albums their release date, not the whole
      // valuation: the catalogs it covered fall back to the default age.
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
