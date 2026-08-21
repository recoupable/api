import { sleep } from "workflow";
import { getMusicGenerationStep } from "@/app/workflows/getMusicGenerationStep";
import { markMusicGenerationStep } from "@/app/workflows/markMusicGenerationStep";
import { submitMusicGenerationStep } from "@/app/workflows/submitMusicGenerationStep";
import { pollMusicGenerationStep } from "@/app/workflows/pollMusicGenerationStep";
import { fetchMusicResultStep } from "@/app/workflows/fetchMusicResultStep";
import { storeMusicAudioStep } from "@/app/workflows/storeMusicAudioStep";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { MUSIC_MODEL, MUSIC_POLL_INTERVAL_MS, MUSIC_POLL_TIMEOUT_MS } from "@/lib/music/const";

/**
 * Durable music generation (recoupable/chat#1992): submit to fal's queue, wait
 * it out, mirror the audio into our own bucket, then charge.
 *
 * Queue-and-poll rather than the blocking `fal.subscribe` every other fal call
 * here uses, because a song takes one to two minutes. The row is the run
 * record — each step writes its own state and timeline line, so the API never
 * has to ask the Workflow API anything.
 *
 * Credits are deducted only after the audio is stored. A generation that fails
 * anywhere before that point costs the caller nothing, which is the behaviour
 * the contract promises.
 *
 * Started fire-and-forget from `startMusicGeneration`.
 */
export async function musicGenerationWorkflow(generationId: string) {
  "use workflow";

  try {
    const generation = await getMusicGenerationStep(generationId);

    const requestId = await submitMusicGenerationStep({
      prompt: generation.prompt,
      lyrics: generation.lyrics,
      duration: generation.requested_duration_seconds ?? 60,
      seed: generation.seed ?? undefined,
      num_inference_steps: generation.num_inference_steps ?? 30,
      guidance_scale: generation.guidance_scale ?? 1.7,
    });

    await markMusicGenerationStep(
      generationId,
      { status: "processing", fal_request_id: requestId },
      `Submitted to fal, model ${MUSIC_MODEL}, request id ${requestId}`,
    );

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
    await markMusicGenerationStep(
      generationId,
      { source_url: result.audioUrl, seed: result.seed, duration_seconds: result.durationSeconds },
      `Audio ready, ${result.durationSeconds ?? "unknown"}s`,
    );

    const stored = await storeMusicAudioStep(generationId, result.audioUrl, result.contentType);

    const creditsCharged = generation.credits_charged ?? 0;
    if (creditsCharged > 0) {
      await recordCreditDeduction({
        accountId: generation.account_id,
        creditsToDeduct: creditsCharged,
        source: "api",
        provider: "fal",
        modelId: MUSIC_MODEL,
      });
    }

    await markMusicGenerationStep(
      generationId,
      {
        status: "completed",
        storage_key: stored.storageKey,
        mime_type: stored.mimeType,
        file_size_bytes: stored.fileSizeBytes,
      },
      `Saved to storage, ${Math.round(stored.fileSizeBytes / 1024 / 1024)} MB`,
    );

    return { success: true as const, generationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[music-generation] Failed for ${generationId}:`, message);
    // Best effort: if the row itself is unreachable there is nothing left to
    // mark, and throwing here would replace a useful error with a confusing one.
    await markMusicGenerationStep(
      generationId,
      { status: "failed", error_message: message },
      `Failed: ${message}`,
    ).catch(() => {});
    return { success: false as const, error: message };
  }
}
