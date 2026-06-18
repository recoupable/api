import { Tables } from "@/types/database.types";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updateSnapshotCatalog } from "@/lib/supabase/playcount_snapshots/updateSnapshotCatalog";

const DEFAULT_CATALOG_NAME = "Valuation Catalog";

/**
 * Materializes a valuation snapshot into an account-linked catalog:
 * creates the `catalogs` row, links it to the account via `account_catalogs`,
 * adds the snapshot's measured ISRCs as `catalog_songs`, and records the new
 * catalog on the snapshot (the idempotency key for re-claims).
 *
 * Callers must first confirm the snapshot is owned by `accountId` and not yet
 * claimed (`snapshot.catalog` is null).
 *
 * @param params.accountId - Owning account (already authorized)
 * @param params.snapshot - The owned, unclaimed snapshot row
 * @param params.name - Optional catalog name; falls back to a default
 * @returns The created catalog and the number of songs added
 */
export async function materializeSnapshotCatalog(params: {
  accountId: string;
  snapshot: Tables<"playcount_snapshots">;
  name?: string;
}): Promise<{ catalog: Tables<"catalogs">; songsAdded: number }> {
  const { accountId, snapshot, name } = params;

  const catalog = await insertCatalog(name ?? DEFAULT_CATALOG_NAME);
  await insertAccountCatalog({ account: accountId, catalog: catalog.id });

  const isrcs = snapshot.isrcs ?? [];
  if (isrcs.length > 0) {
    await insertCatalogSongs(isrcs.map(isrc => ({ catalog: catalog.id, song: isrc })));
  }

  await updateSnapshotCatalog({ snapshotId: snapshot.id, catalogId: catalog.id });

  return { catalog, songsAdded: isrcs.length };
}
