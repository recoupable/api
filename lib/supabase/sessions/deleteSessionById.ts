import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes the session with the given id. Used for rollback when a
 * subsequent insert (e.g. the initial chat) fails after the session
 * row was already persisted.
 *
 * @param id - The session id to delete.
 * @returns `true` on success, `false` if the delete failed.
 */
export async function deleteSessionById(id: string): Promise<boolean> {
  const { error } = await supabase.from("sessions").delete().eq("id", id);

  if (error) {
    console.error("Error deleting session:", error);
    return false;
  }

  return true;
}
