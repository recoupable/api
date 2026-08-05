import { insertCatalogValuation } from "@/lib/supabase/catalog_valuations/insertCatalogValuation";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";

/**
 * Persist a computed valuation band into the catalog's history
 * (catalog_valuations, chat#1889 row 15). Best-effort: valuation reads and
 * runs must never fail because history could not be written.
 *
 * With `dedupeDaily`, at most one row lands per catalog per UTC day — the
 * mode for read-time persistence (GET /catalogs/{id}/measurements), where
 * every page view would otherwise mint a row. Valuation runs persist
 * unconditionally: each run is a fresh measurement worth keeping.
 *
 * @param params.catalogId - The catalog the band was computed for
 * @param params.valuation - The computed band (low/mid/high, whole-catalog scope)
 * @param params.measuredSongCount - Songs measured in the aggregate
 * @param params.totalStreams - Total streams in the aggregate
 * @param params.dedupeDaily - Skip when a row already exists for today (UTC)
 */
export async function persistCatalogValuation({
  catalogId,
  valuation,
  measuredSongCount,
  totalStreams,
  dedupeDaily = false,
}: {
  catalogId: string;
  valuation: { low: number; mid: number; high: number };
  measuredSongCount: number;
  totalStreams: number;
  dedupeDaily?: boolean;
}): Promise<void> {
  try {
    if (dedupeDaily) {
      const latest = await selectCatalogValuations({ catalogId, limit: 1 });
      const newestDay = latest?.[0]?.measured_at?.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      if (newestDay === today) return;
    }

    await insertCatalogValuation({
      catalog_id: catalogId,
      low: valuation.low,
      mid: valuation.mid,
      high: valuation.high,
      measured_song_count: measuredSongCount,
      total_streams: totalStreams,
    });
  } catch (error) {
    console.error("Error persisting catalog valuation:", error);
  }
}
