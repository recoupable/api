import { start } from "workflow/api";
import { insertMusicGeneration } from "@/lib/supabase/music_generations/insertMusicGeneration";
import { updateMusicGeneration } from "@/lib/supabase/music_generations/updateMusicGeneration";
import { musicGenerationWorkflow } from "@/app/workflows/music/musicGenerationWorkflow";
import { creditCostForDuration } from "@/lib/music/creditCostForDuration";
import { MUSIC_MODEL } from "@/lib/music/const";
import type { ValidatedCreateMusicBody } from "@/lib/music/validateCreateMusicBody";
import type { Tables } from "@/types/database.types";

/**
 * Create the generation row and hand it to the workflow.
 *
 * The insert comes first and is the claim: the row exists in `pending` before
 * anything is started, so the response describes a real resource and a
 * workflow that begins immediately always finds something to update.
 *
 * Generation parameters and the price travel as workflow arguments rather than
 * columns. `start()` arguments are durable, so they cannot drift mid-run, and
 * the table stays narrow — nothing is stored that only the run needs.
 *
 * @param validated - Validated body plus the resolved account.
 * @returns The inserted row.
 */
export async function startMusicGeneration(
  validated: ValidatedCreateMusicBody,
): Promise<Tables<"music_generations">> {
  const row = await insertMusicGeneration({
    account_id: validated.accountId,
    status: "pending",
    model: MUSIC_MODEL,
    prompt: validated.prompt,
    lyrics: validated.lyrics,
  });

  const run = await start(musicGenerationWorkflow, [
    row.id,
    {
      duration: validated.duration,
      seed: validated.seed,
      num_inference_steps: validated.num_inference_steps,
      guidance_scale: validated.guidance_scale,
      creditsToCharge: creditCostForDuration(validated.duration),
    },
  ]);

  // Persisted immediately rather than from inside the workflow: if a run dies
  // without reaching its own error handler, this id is the only way back to
  // its history. Best effort, because a generation that is already running
  // must not be failed by a bookkeeping write.
  const withRun = await updateMusicGeneration(row.id, { workflow_run_id: run.runId }).catch(
    () => row,
  );

  return withRun;
}
