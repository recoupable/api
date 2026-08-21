import supabase from "../serverClient";
import { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Update a music generation row and return the updated row.
 *
 * Returns the row rather than void (unlike `updatePlaycountSnapshot`) because
 * the workflow appends to `logs` read-modify-write, and the caller needs the
 * committed value back to keep appending.
 *
 * @param id - The generation id.
 * @param fields - Fields to update.
 * @returns The updated row.
 */
export async function updateMusicGeneration(
  id: string,
  fields: TablesUpdate<"music_generations">,
): Promise<Tables<"music_generations">> {
  const { data, error } = await supabase
    .from("music_generations")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update music generation: ${error.message}`);
  }

  return data;
}
