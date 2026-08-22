import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";
import type { Tables } from "@/types/database.types";

/**
 * Load a generation row from inside the workflow.
 *
 * @param generationId - The generation id.
 * @returns The row.
 * @throws Error when the generation does not exist (fatal, no retry value).
 */
export async function getMusicGenerationStep(
  generationId: string,
): Promise<Tables<"music_generations">> {
  "use step";
  const rows = await selectMusicGenerations({ id: generationId });
  if (rows.length === 0) throw new Error(`Music generation ${generationId} not found`);
  return rows[0];
}
