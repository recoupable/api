import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { Tables } from "@/types/database.types";

/**
 * Load a snapshot job row from inside the workflow.
 *
 * @param snapshotId - The snapshot job id
 * @returns The row
 * @throws Error when the snapshot does not exist (fatal — no retry value)
 */
export async function getSnapshotStep(snapshotId: string): Promise<Tables<"playcount_snapshots">> {
  "use step";
  const rows = await selectPlaycountSnapshots({ id: snapshotId });
  if (rows.length === 0) throw new Error(`Snapshot ${snapshotId} not found`);
  return rows[0];
}
