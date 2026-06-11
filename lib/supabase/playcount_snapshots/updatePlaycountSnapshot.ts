import supabase from "../serverClient";
import { TablesUpdate } from "@/types/database.types";

/**
 * Update a snapshot job row (state transitions, counts, cost).
 *
 * @param id - The snapshot id
 * @param fields - Fields to update
 * @throws Error if the update fails
 */
export async function updatePlaycountSnapshot(
  id: string,
  fields: TablesUpdate<"playcount_snapshots">,
): Promise<void> {
  const { error } = await supabase.from("playcount_snapshots").update(fields).eq("id", id);

  if (error) {
    throw new Error(`Failed to update playcount snapshot: ${error.message}`);
  }
}
