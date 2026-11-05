import { FLAMINGO_GENERATE_BATCH_URL } from "@/lib/const";
import { getModalProxyAuthHeaders } from "@/lib/flamingo/getModalProxyAuthHeaders";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";
import type { FlamingoGenerateBatchBody } from "@/lib/flamingo/flamingoGenerateBatchBodySchema";
import {
  isFlamingoGenerateBatchResult,
  type FlamingoGenerateBatchResult,
} from "@/lib/flamingo/isFlamingoGenerateBatchResult";

/**
 * Calls the Music Flamingo /generate_batch endpoint on Modal: every prompt
 * answered in one request on one download of the audio.
 *
 * @param params - The validated batch body (defaults applied).
 * @param options - Optional abort signal.
 * @returns Every prompt's answer and the batch's total seconds.
 * @throws FlamingoServiceError if the Modal endpoint returns a non-OK status.
 */
export async function callFlamingoGenerateBatch(
  params: FlamingoGenerateBatchBody,
  options?: { signal?: AbortSignal },
): Promise<FlamingoGenerateBatchResult> {
  const response = await fetch(FLAMINGO_GENERATE_BATCH_URL, {
    method: "POST",
    ...(options?.signal ? { signal: options.signal } : {}),
    headers: {
      "Content-Type": "application/json",
      ...getModalProxyAuthHeaders(),
    },
    body: JSON.stringify({
      audio_url: params.audio_url,
      prompts: params.prompts.map(({ id, prompt, max_new_tokens }) => ({
        id,
        prompt,
        max_new_tokens,
      })),
      temperature: params.temperature,
      top_p: params.top_p,
      do_sample: params.do_sample,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`Audio model batch returned ${response.status}: ${errorText}`);
    throw new FlamingoServiceError(response.status, errorText);
  }

  const data = await response.json();
  if (!isFlamingoGenerateBatchResult(data)) {
    throw new Error("Audio model returned an unexpected response shape");
  }
  return data;
}
