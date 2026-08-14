import { computeValuationBand, type ValuationBand } from "./computeValuationBand";
import { aggregateWithRetry } from "./aggregateWithRetry";
import { getEarliestReleaseDates } from "./getEarliestReleaseDates";

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
 * The two inputs are gathered in parallel: the stream aggregate per catalog
 * (`aggregateWithRetry` — the RPC has no batched form, so this is the only work
 * that scales one-for-one with catalog count) and the catalog ages
 * (`getEarliestReleaseDates`, batched across the whole list).
 *
 * A catalog with nothing measured gets `valuation: null`, never a $0 band: 34 of
 * the 70 catalogs renamed in chat#1942 have no measured songs, so a client must
 * be able to say "not measured" instead of implying worthlessness.
 *
 * @param catalogIds - Catalogs to value
 * @returns catalog id → `{ measuredSongCount, valuation }`
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
