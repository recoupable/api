import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbums from "@/lib/spotify/getAlbums";
import { computeValuationBand, type ValuationBand } from "./computeValuationBand";

export type CatalogValuationSummary = {
  measuredSongCount: number;
  valuation: ValuationBand | null;
};

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
    Promise.all(catalogIds.map(catalogId => selectCatalogMeasurementsAggregate({ catalogId }))),
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

  const { albums } = await getAlbums({ ids: albumIds, accessToken: access_token });
  if (!albums) return earliest;

  const releaseDateById = new Map(
    albums.filter(album => album.release_date).map(album => [album.id, album.release_date!]),
  );

  for (const [catalogId, ids] of albumIdsByCatalog) {
    const dates = ids
      .map(id => releaseDateById.get(id))
      .filter((date): date is string => Boolean(date))
      .sort();
    if (dates[0]) earliest.set(catalogId, dates[0]);
  }

  return earliest;
}
