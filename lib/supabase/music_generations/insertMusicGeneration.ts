import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert a music generation row.
 *
 * The insert is the claim: the row exists in `pending` before the workflow is
 * started, so a workflow that begins immediately always finds something to
 * update.
 *
 * @param generation - Row to insert.
 * @returns The inserted row.
 */
export async function insertMusicGeneration(
  generation: TablesInsert<"music_generations">,
): Promise<Tables<"music_generations">> {
  const { data, error } = await supabase
    .from("music_generations")
    .insert(generation)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert music generation: ${error.message}`);
  }

  return data;
}
