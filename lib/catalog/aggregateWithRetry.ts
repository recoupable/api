import {
  selectCatalogMeasurementsAggregate,
  type CatalogMeasurementsAggregate,
} from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";

/**
 * The measurements aggregate for one catalog, retried once.
 *
 * `selectCatalogMeasurementsAggregate` returns null both when the RPC fails and
 * for a catalog with nothing measured, so a transient failure would otherwise be
 * published as "not measured". That is not theoretical: preview testing caught a
 * 9,939-song catalog reporting a null valuation on one run and $88.9M on the
 * next (chat#1943). One retry costs a single extra RPC on the rare failure; a
 * still-failing catalog is logged, because at that point the caller cannot tell
 * zero from unknown.
 *
 * @param catalogId - The catalog to aggregate
 * @returns The aggregate, or null when both attempts fail
 */
export async function aggregateWithRetry(
  catalogId: string,
): Promise<CatalogMeasurementsAggregate | null> {
  const first = await selectCatalogMeasurementsAggregate({ catalogId });
  if (first) return first;

  const second = await selectCatalogMeasurementsAggregate({ catalogId });
  if (!second) {
    console.error(
      `[aggregateWithRetry] measurements aggregate failed twice for catalog ${catalogId}; reporting it as unmeasured`,
    );
  }
  return second;
}
