import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert a snapshot job row (mints the snapshot_id returned by
 * POST /api/research/snapshots).
 *
 * @param snapshot - The snapshot job to insert
 * @returns The inserted row
 * @throws Error if the insert fails
 */
export async function insertPlaycountSnapshot(
  snapshot: TablesInsert<"playcount_snapshots">,
): Promise<Tables<"playcount_snapshots">> {
  const { data, error } = await supabase
    .from("playcount_snapshots")
    .insert(snapshot)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert playcount snapshot: ${error.message}`);
  }

  return data;
}
