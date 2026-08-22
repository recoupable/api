import { updateMusicGeneration } from "@/lib/supabase/music_generations/updateMusicGeneration";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Persist a generation state transition from inside the workflow.
 *
 * @param generationId - The generation id.
 * @param fields - Columns to update.
 * @returns The updated row.
 */
export async function markMusicGenerationStep(
  generationId: string,
  fields: TablesUpdate<"music_generations">,
): Promise<Tables<"music_generations">> {
  "use step";
  return updateMusicGeneration(generationId, fields);
}
