import supabase from "../serverClient";

/**
 * Delete a snapshot job row.
 *
 * Used to withdraw a losing claim when two simultaneous identical requests
 * both inserted before either could see the other, so one capture is left
 * rather than two (chat#1912 row 7).
 *
 * @param id - The snapshot id
 * @throws Error if the delete fails
 */
export async function deletePlaycountSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from("playcount_snapshots").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete playcount snapshot: ${error.message}`);
  }
}
