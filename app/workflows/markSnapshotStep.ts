import { updatePlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/updatePlaycountSnapshot";
import { TablesUpdate } from "@/types/database.types";

/**
 * Persist a snapshot job state transition from inside the workflow.
 *
 * @param snapshotId - The snapshot job id
 * @param fields - Fields to update (state, counts)
 */
export async function markSnapshotStep(
  snapshotId: string,
  fields: TablesUpdate<"playcount_snapshots">,
): Promise<void> {
  "use step";
  await updatePlaycountSnapshot(snapshotId, fields);
}
