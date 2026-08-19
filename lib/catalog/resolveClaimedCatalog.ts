import { Tables } from "@/types/database.types";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { createSnapshotCatalog } from "./createSnapshotCatalog";

/**
 * The claimed catalog for a snapshot: reuses the catalog a prior claim already
 * produced (idempotent re-claim, keyed on `snapshot.catalog`) or materializes
 * a new one via createSnapshotCatalog. Either way the measured ISRCs come back
 * so the caller can run the roster attach and own its failure policy
 * (chat#1965).
 *
 * @param params.accountId - The claiming account (already authorized)
 * @param params.ownerId - The account that owns the catalog (the claimer, or
 *   an organization — chat#1938)
 * @param params.snapshot - The claimer-owned snapshot row
 * @param params.name - Optional catalog name for a fresh materialization
 * @returns The catalog, the number of songs newly added, and the measured ISRCs
 */
export async function resolveClaimedCatalog(params: {
  accountId: string;
  ownerId: string;
  snapshot: Tables<"playcount_snapshots">;
  name?: string;
}): Promise<{ catalog: Tables<"catalogs">; songsAdded: number; isrcs: string[] }> {
  const { accountId, ownerId, snapshot, name } = params;

  if (snapshot.catalog) {
    const existing = await selectCatalogById(snapshot.catalog);
    if (existing) {
      const measurements = await selectSongMeasurements({ snapshot: snapshot.id });
      const isrcs = [...new Set(measurements.map(m => m.song))];
      return { catalog: existing, songsAdded: 0, isrcs };
    }
  }

  return createSnapshotCatalog({ accountId, ownerId, snapshot, name });
}
