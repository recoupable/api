import { updateScheduledPost } from "@/lib/supabase/scheduled_posts/updateScheduledPost";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Persist a post state transition from inside the workflow.
 *
 * @param postId - The post id.
 * @param fields - Columns to update.
 * @returns The updated row.
 */
export async function markPostStep(
  postId: string,
  fields: TablesUpdate<"scheduled_posts">,
): Promise<Tables<"scheduled_posts">> {
  "use step";
  return updateScheduledPost(postId, fields);
}
