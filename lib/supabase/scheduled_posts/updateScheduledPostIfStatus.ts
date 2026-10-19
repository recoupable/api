import supabase from "../serverClient";
import { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Update a scheduled post only while it is still in `fromStatus`, in one
 * statement, so two writers racing on the same post (a cancel and the
 * publish run waking up) cannot both win.
 *
 * @param id - The post id.
 * @param fromStatus - The status the row must still have.
 * @param fields - Fields to update.
 * @returns The updated row, or null when the row was not in `fromStatus`.
 */
export async function updateScheduledPostIfStatus(
  id: string,
  fromStatus: Tables<"scheduled_posts">["status"],
  fields: TablesUpdate<"scheduled_posts">,
): Promise<Tables<"scheduled_posts"> | null> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .update(fields)
    .eq("id", id)
    .eq("status", fromStatus)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update scheduled post: ${error.message}`);
  }

  return data;
}
