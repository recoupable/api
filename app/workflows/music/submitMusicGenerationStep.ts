import fal from "@/lib/fal/server";
import { MUSIC_MODEL } from "@/lib/music/const";

export type SubmitMusicGenerationInput = {
  prompt: string;
  lyrics: string;
  duration: number;
  seed?: number;
  num_inference_steps: number;
  guidance_scale: number;
};

/**
 * Hand the generation to fal's queue and return its request id.
 *
 * Queued rather than `fal.subscribe`, which every other fal call in this repo
 * uses: a song takes one to two minutes, so holding the connection open would
 * outlive the function. The request id is the handle the poll step needs, and
 * is persisted on the row so a stalled generation can be chased in fal's own
 * dashboard.
 *
 * @param input - Generation parameters, already validated and defaulted.
 * @returns fal's request id.
 */
export async function submitMusicGenerationStep(
  input: SubmitMusicGenerationInput,
): Promise<string> {
  "use step";
  const { request_id } = await fal.queue.submit(MUSIC_MODEL, {
    input: {
      prompt: input.prompt,
      lyrics: input.lyrics,
      duration: input.duration,
      num_inference_steps: input.num_inference_steps,
      guidance_scale: input.guidance_scale,
      // Omitted rather than sent as null: fal treats an absent seed as
      // "choose one", and reports the seed it chose in the result.
      ...(input.seed === undefined ? {} : { seed: input.seed }),
    },
  });

  return request_id;
}
