import { selectMusicGenerations } from "@/lib/supabase/music_generations/selectMusicGenerations";
import { updateMusicGeneration } from "@/lib/supabase/music_generations/updateMusicGeneration";
import { appendLogEntry } from "@/lib/music/appendLogEntry";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Persist a generation state transition and add a line to its timeline.
 *
 * Reads before writing because `logs` is a jsonb array appended in place and
 * there is no append RPC. Safe without locking: the only writer to a given
 * generation is its own workflow, whose steps run one at a time.
 *
 * @param generationId - The generation id.
 * @param fields - Columns to update.
 * @param message - Timeline line describing what just happened.
 * @returns The updated row.
 */
export async function markMusicGenerationStep(
  generationId: string,
  fields: TablesUpdate<"music_generations">,
  message: string,
): Promise<Tables<"music_generations">> {
  "use step";
  const [current] = await selectMusicGenerations({ id: generationId });
  const logs = appendLogEntry(current?.logs ?? null, message);

  return updateMusicGeneration(generationId, { ...fields, logs });
}
