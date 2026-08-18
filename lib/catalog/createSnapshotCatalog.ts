import { Tables } from "@/types/database.types";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

const DEFAULT_CATALOG_NAME = "Valuation Catalog";

/**
 * Creates a catalog from a valuation snapshot: creates the
 * `catalogs` row, links it to its owner via `account_catalogs`, adds the
 * snapshot's **measured** ISRCs (from `song_measurements`, not the snapshot's
 * own `isrcs` column — that's null for album-scoped valuation runs) as
 * `catalog_songs`, and records the new catalog on the snapshot (the
 * idempotency key for re-claims).
 *
 * Returns the measured ISRCs so the calling surface can run the roster attach
 * (attachCanonicalArtistToAccount) and own its failure policy — materializing
 * the catalog and populating the roster are separate concerns (chat#1965).
 *
 * Callers must first confirm the snapshot is owned by `accountId` and not yet
 * claimed (`snapshot.catalog` is null).
 *
 * @param params.accountId - The claiming account (already authorized). Owns the
 *   catalog unless `ownerId` says otherwise.
 * @param params.ownerId - Optional account to own the catalog instead of
 *   `accountId` — an organization id, so every member sees it (chat#1938).
 * @param params.snapshot - The owned, unclaimed snapshot row
 * @param params.name - Optional catalog name; falls back to a default
 * @returns The created catalog, the number of songs added, and the measured
 *   (deduped) ISRCs
 */
export async function createSnapshotCatalog(params: {
  accountId: string;
  ownerId?: string;
  snapshot: Tables<"playcount_snapshots">;
  name?: string;
}): Promise<{
  catalog: Tables<"catalogs">;
  songsAdded: number;
  isrcs: string[];
}> {
  const { accountId, ownerId, snapshot, name } = params;

  const catalog = await insertCatalog(name ?? DEFAULT_CATALOG_NAME);
  await insertAccountCatalog({ account: ownerId ?? accountId, catalog: catalog.id });

  const measurements = await selectSongMeasurements({ snapshot: snapshot.id });
  const isrcs = [...new Set(measurements.map(m => m.song))];
  if (isrcs.length > 0) {
    await insertCatalogSongs(isrcs.map(isrc => ({ catalog: catalog.id, song: isrc })));
  }

  await updatePlaycountSnapshot(snapshot.id, { catalog: catalog.id });

  return { catalog, songsAdded: isrcs.length, isrcs };
}
