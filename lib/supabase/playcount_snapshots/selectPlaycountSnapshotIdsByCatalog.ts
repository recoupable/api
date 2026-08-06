import supabase from "../serverClient";

/**
 * The ids of the snapshots that point at a catalog.
 *
 * Separate from `selectPlaycountSnapshots` because the caller here needs to
 * tell "no snapshots" apart from "the query failed": deleting a catalog clears
 * these references (`playcount_snapshots.catalog` is `ON DELETE SET NULL`), and
 * the ids are the only handle left for re-claiming the paid-for measurement.
 * `selectPlaycountSnapshots` returns `[]` on error, which would silently report
 * a recoverable snapshot as none.
 *
 * @param catalogId - The catalog the snapshots reference
 * @returns The snapshot ids, or null when the query fails
 */
export async function selectPlaycountSnapshotIdsByCatalog(
  catalogId: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("playcount_snapshots")
    .select("id")
    .eq("catalog", catalogId);

  if (error) {
    console.error("Error fetching playcount_snapshots by catalog:", error);
    return null;
  }

  return (data ?? []).map(row => row.id);
}
