import { Tables } from "@/types/database.types";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { attachCanonicalArtistToAccount } from "./attachCanonicalArtistToAccount";

const DEFAULT_CATALOG_NAME = "Valuation Catalog";

/**
 * Creates a catalog from a valuation snapshot: creates the
 * `catalogs` row, links it to its owner via `account_catalogs`, adds the
 * snapshot's **measured** ISRCs (from `song_measurements`, not the snapshot's
 * own `isrcs` column — that's null for album-scoped valuation runs) as
 * `catalog_songs`, attaches the songs' canonical artist to the account's
 * roster (chat#1850 P1), and records the new catalog on the snapshot (the
 * idempotency key for re-claims).
 *
 * Returns the attached canonical artist id (or null when the ISRC →
 * song_artists graph resolves no artist) so the caller can decide whether a
 * searched-artist fallback link is needed for a populated roster (chat#1881 P0).
 *
 * Callers must first confirm the snapshot is owned by `accountId` and not yet
 * claimed (`snapshot.catalog` is null).
 *
 * @param params.accountId - The claiming account (already authorized). Owns the
 *   catalog unless `ownerId` says otherwise, and always receives the roster attach.
 * @param params.ownerId - Optional account to own the catalog instead of
 *   `accountId` — an organization id, so every member sees it (chat#1938).
 *   Ownership only; the roster attach still targets `accountId`, because the
 *   artist belongs on the roster of whoever ran the claim.
 * @param params.snapshot - The owned, unclaimed snapshot row
 * @param params.name - Optional catalog name; falls back to a default
 * @returns The created catalog, the number of songs added, and the attached
 *   canonical artist id (null when none was resolved)
 */
export async function createSnapshotCatalog(params: {
  accountId: string;
  ownerId?: string;
  snapshot: Tables<"playcount_snapshots">;
  name?: string;
}): Promise<{
  catalog: Tables<"catalogs">;
  songsAdded: number;
  attachedArtistId: string | null;
}> {
  const { accountId, ownerId, snapshot, name } = params;

  const catalog = await insertCatalog(name ?? DEFAULT_CATALOG_NAME);
  await insertAccountCatalog({ account: ownerId ?? accountId, catalog: catalog.id });

  const measurements = await selectSongMeasurements({ snapshot: snapshot.id });
  const isrcs = [...new Set(measurements.map(m => m.song))];
  let attachedArtistId: string | null = null;
  if (isrcs.length > 0) {
    await insertCatalogSongs(isrcs.map(isrc => ({ catalog: catalog.id, song: isrc })));
    // Roster attach (chat#1850 P1): the claim is when the account takes
    // ownership, so link the songs' canonical artist here — the marketing
    // funnel no longer mints a per-signup duplicate artist.
    attachedArtistId = await attachCanonicalArtistToAccount({ accountId, isrcs });
  }

  await updatePlaycountSnapshot(snapshot.id, { catalog: catalog.id });

  return { catalog, songsAdded: isrcs.length, attachedArtistId };
}
