import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert a scheduled post row.
 *
 * The insert is the claim: the row exists before the publish workflow starts,
 * so a workflow that begins immediately always finds something to update.
 *
 * @param post - Row to insert.
 * @returns The inserted row.
 */
export async function insertScheduledPost(
  post: TablesInsert<"scheduled_posts">,
): Promise<Tables<"scheduled_posts">> {
  const { data, error } = await supabase.from("scheduled_posts").insert(post).select().single();

  if (error) {
    throw new Error(`Failed to insert scheduled post: ${error.message}`);
  }

  return data;
}
