import supabase from "../serverClient";
import { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Update a scheduled post row and return the updated row.
 *
 * @param id - The post id.
 * @param fields - Fields to update.
 * @returns The updated row.
 */
export async function updateScheduledPost(
  id: string,
  fields: TablesUpdate<"scheduled_posts">,
): Promise<Tables<"scheduled_posts">> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update scheduled post: ${error.message}`);
  }

  return data;
}
