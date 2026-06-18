import supabase from "../serverClient";

/**
 * Sets the `catalog` foreign key on a `playcount_snapshots` row. This records
 * which catalog a valuation run was materialized into, and is the idempotency
 * key for re-claims (a snapshot with `catalog` set is already materialized).
 *
 * @param params.snapshotId - Snapshot id to update
 * @param params.catalogId - Catalog id to record on the snapshot
 * @throws Error if the update fails
 */
export async function updateSnapshotCatalog(params: {
  snapshotId: string;
  catalogId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("playcount_snapshots")
    .update({ catalog: params.catalogId })
    .eq("id", params.snapshotId);

  if (error) {
    throw new Error(`Failed to set snapshot catalog: ${error.message}`);
  }
}
