import { start } from "workflow/api";
import { insertMusicGeneration } from "@/lib/supabase/music_generations/insertMusicGeneration";
import { musicGenerationWorkflow } from "@/app/workflows/musicGenerationWorkflow";
import { creditCostForDuration } from "@/lib/music/creditCostForDuration";
import { MUSIC_MODEL } from "@/lib/music/const";
import type { ValidatedCreateMusicBody } from "@/lib/music/validateCreateMusicBody";
import type { Tables } from "@/types/database.types";

/**
 * Create the generation row and hand it to the workflow.
 *
 * The insert comes first and is the claim: the row exists in `pending` before
 * anything is started, so the response can describe a real resource and a
 * workflow that begins immediately always finds something to update.
 *
 * The price is frozen onto the row here rather than recomputed at deduction
 * time, so the amount charged is provably the amount quoted, even if the
 * pricing constants move while a generation is in flight.
 *
 * @param validated - Validated body plus resolved account and organization.
 * @returns The inserted row.
 */
export async function startMusicGeneration(
  validated: ValidatedCreateMusicBody,
): Promise<Tables<"music_generations">> {
  const row = await insertMusicGeneration({
    account_id: validated.accountId,
    organization_id: validated.organizationId,
    status: "pending",
    model: MUSIC_MODEL,
    prompt: validated.prompt,
    lyrics: validated.lyrics,
    requested_duration_seconds: validated.duration,
    seed: validated.seed ?? null,
    num_inference_steps: validated.num_inference_steps,
    guidance_scale: validated.guidance_scale,
    credits_charged: creditCostForDuration(validated.duration),
    logs: [{ at: new Date().toISOString(), message: "Run started" }],
  });

  await start(musicGenerationWorkflow, [row.id]);

  return row;
}
