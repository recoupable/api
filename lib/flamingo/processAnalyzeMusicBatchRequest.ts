import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";
import { chargeForFlamingoBatch } from "@/lib/flamingo/chargeForFlamingoBatch";
import type { FlamingoGenerateBatchBody } from "@/lib/flamingo/flamingoGenerateBatchBodySchema";
import type { FlamingoBatchAnswer } from "@/lib/flamingo/isFlamingoGenerateBatchResult";
import type { AnalyzeMusicContext } from "@/lib/flamingo/processAnalyzeMusicRequest";

/** Every prompt's answer from one batch. */
export interface AnalyzeMusicBatchSuccess {
  type: "success";
  answers: FlamingoBatchAnswer[];
  /** Wall time for the whole batch, in seconds; what the charge is priced on. */
  elapsed_seconds: number;
  /** How many prompts the batch answered. */
  prompts: number;
}

/**
 * Shared business logic for batched music analysis: runs every prompt in one
 * model request on one download of the audio, then charges the account once
 * (one base price plus the batch's total seconds) after it succeeds.
 * Callers verify `params.audio_url` and gate the balance on one base price
 * before calling this.
 *
 * @param params - The validated batch body.
 * @param context - The account the batch is charged to.
 * @returns The answers, total seconds and prompt count.
 * @throws FlamingoServiceError when the model service rejects the batch;
 *   nothing is charged then.
 */
export async function processAnalyzeMusicBatchRequest(
  params: FlamingoGenerateBatchBody,
  context: AnalyzeMusicContext,
): Promise<AnalyzeMusicBatchSuccess> {
  const result = await callFlamingoGenerateBatch(params);
  const promptCount = params.prompts.length;

  await chargeForFlamingoBatch({
    accountId: context.accountId,
    elapsedSeconds: result.elapsed_seconds,
    promptCount,
    ...(context.recordAudioUrl === false ? {} : { audioUrl: params.audio_url }),
  });

  return {
    type: "success",
    answers: result.answers,
    elapsed_seconds: result.elapsed_seconds,
    prompts: promptCount,
  };
}
