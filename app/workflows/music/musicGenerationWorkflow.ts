import { sleep } from "workflow";
import { getMusicGenerationStep } from "@/app/workflows/music/getMusicGenerationStep";
import { markMusicGenerationStep } from "@/app/workflows/music/markMusicGenerationStep";
import { submitMusicGenerationStep } from "@/app/workflows/music/submitMusicGenerationStep";
import { pollMusicGenerationStep } from "@/app/workflows/music/pollMusicGenerationStep";
import { fetchMusicResultStep } from "@/app/workflows/music/fetchMusicResultStep";
import { storeMusicAudioStep } from "@/app/workflows/music/storeMusicAudioStep";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { MUSIC_MODEL, MUSIC_POLL_INTERVAL_MS, MUSIC_POLL_TIMEOUT_MS } from "@/lib/music/const";

export type MusicGenerationParams = {
  duration: number;
  seed?: number;
  num_inference_steps: number;
  guidance_scale: number;
  creditsToCharge: number;
};

/**
 * Durable music generation (recoupable/chat#1992): submit to fal's queue, wait
 * it out, mirror the audio into our own bucket, then charge.
 *
 * Queue-and-poll rather than the blocking `fal.subscribe` every other fal call
 * here uses, because a song takes one to two minutes.
 *
 * Parameters arrive as arguments rather than being read back out of the row.
 * `start()` arguments are durable, so the price quoted to the caller is the
 * price charged here even if the pricing constants move mid-run, and the table
 * carries no column that only this function needs.
 *
 * Credits are deducted only after the audio is stored, so a generation that
 * fails anywhere earlier costs the caller nothing.
 */
export async function musicGenerationWorkflow(generationId: string, params: MusicGenerationParams) {
  "use workflow";

  try {
    const generation = await getMusicGenerationStep(generationId);

    const requestId = await submitMusicGenerationStep({
      prompt: generation.prompt,
      lyrics: generation.lyrics,
      duration: params.duration,
      seed: params.seed,
      num_inference_steps: params.num_inference_steps,
      guidance_scale: params.guidance_scale,
    });

    await markMusicGenerationStep(generationId, {
      status: "processing",
      fal_request_id: requestId,
    });

    const deadline = Date.now() + MUSIC_POLL_TIMEOUT_MS;
    let state = await pollMusicGenerationStep(requestId);
    while (state !== "completed") {
      if (Date.now() > deadline) {
        throw new Error("Music generation timed out waiting for fal");
      }
      await sleep(new Date(Date.now() + MUSIC_POLL_INTERVAL_MS));
      state = await pollMusicGenerationStep(requestId);
    }

    const result = await fetchMusicResultStep(requestId);
    const stored = await storeMusicAudioStep(generationId, result.audioUrl, result.contentType);

    if (params.creditsToCharge > 0) {
      await recordCreditDeduction({
        accountId: generation.account_id,
        creditsToDeduct: params.creditsToCharge,
        source: "api",
        provider: "fal",
        modelId: MUSIC_MODEL,
      });
    }

    await markMusicGenerationStep(generationId, {
      status: "completed",
      storage_key: stored.storageKey,
      duration_seconds: result.durationSeconds,
    });

    return { success: true as const, generationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[music-generation] Failed for ${generationId}:`, message);
    // Best effort: if the row itself is unreachable there is nothing left to
    // mark, and throwing here would replace a useful error with a confusing one.
    await markMusicGenerationStep(generationId, {
      status: "failed",
      error_message: message,
    }).catch(() => {});
    return { success: false as const, error: message };
  }
}
