import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "./getCatalogEarliestReleaseDate";
import { computeValuationBand } from "./computeValuationBand";

export interface CatalogValuationPoint {
  low: number;
  mid: number;
  high: number;
  measured_at: string;
}

export interface CatalogValuationDelta {
  current: CatalogValuationPoint;
  previous: CatalogValuationPoint | null;
}

/**
 * The catalog's current value and the previous measurement to diff against —
 * the pair the delta-led report email renders (chat#1911 row 5). Reads the
 * two most recent history rows; a catalog with history but no second row is
 * a baseline (previous null). A catalog with no history yet falls back to
 * the read-time band when songs are measured, so the first report after the
 * history table ships still leads with a number.
 *
 * Best-effort: returns null (no delta, email unchanged) on empty catalogs
 * and on any failure — never throws, a send must not die on this.
 *
 * @param params.catalogId - The catalog to value
 * @returns The current/previous pair, or null when there is nothing to say
 */
export async function getCatalogValuationDelta({
  catalogId,
}: {
  catalogId: string;
}): Promise<CatalogValuationDelta | null> {
  try {
    const rows = await selectCatalogValuations({ catalogId, limit: 2 });
    if (rows && rows.length > 0) {
      const [current, previous] = rows;
      return {
        current: toPoint(current),
        previous: previous ? toPoint(previous) : null,
      };
    }

    const [aggregate, earliestReleaseDate] = await Promise.all([
      selectCatalogMeasurementsAggregate({ catalogId }),
      getCatalogEarliestReleaseDate(catalogId),
    ]);
    if (!aggregate || aggregate.measuredSongCount === 0) return null;

    const { valuation } = computeValuationBand({
      totalStreams: aggregate.totalStreams,
      earliestReleaseDate,
    });
    return {
      current: { ...valuation, measured_at: new Date().toISOString() },
      previous: null,
    };
  } catch (error) {
    console.error("Error resolving catalog valuation delta:", error);
    return null;
  }
}

function toPoint(row: {
  low: number;
  mid: number;
  high: number;
  measured_at: string;
}): CatalogValuationPoint {
  return {
    low: Number(row.low),
    mid: Number(row.mid),
    high: Number(row.high),
    measured_at: row.measured_at,
  };
}
