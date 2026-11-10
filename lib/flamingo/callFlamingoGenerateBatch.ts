import { FLAMINGO_GENERATE_BATCH_URL } from "@/lib/const";
import { getModalProxyAuthHeaders } from "@/lib/flamingo/getModalProxyAuthHeaders";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";
import type { FlamingoGenerateBatchBody } from "@/lib/flamingo/flamingoGenerateBatchBodySchema";
import {
  isFlamingoGenerateBatchResult,
  type FlamingoGenerateBatchResult,
} from "@/lib/flamingo/isFlamingoGenerateBatchResult";

/**
 * One prompt as sent to Modal. `clip` (seconds) has the model hear only that
 * stretch of the audio; `temperature`, `top_p` and `do_sample` override the
 * batch's settings for this prompt alone. The public batch body's prompts
 * carry neither, so they fit as they are.
 */
export interface FlamingoBatchPrompt {
  id: string;
  prompt: string;
  max_new_tokens: number;
  clip?: { start: number; end: number };
  temperature?: number;
  top_p?: number;
  do_sample?: boolean;
}

/** A batch request: the public body's settings, with prompts that may carry clips and settings. */
export type FlamingoBatchRequest = Omit<FlamingoGenerateBatchBody, "prompts"> & {
  prompts: FlamingoBatchPrompt[];
};

/**
 * Calls the Music Flamingo /generate_batch endpoint on Modal: every prompt
 * answered in one request on one download of the audio.
 *
 * @param params - The validated batch body (defaults applied), or an internal
 *   request whose prompts carry clips or their own settings.
 * @param options - Optional abort signal.
 * @returns Every prompt's answer and the batch's total seconds.
 * @throws FlamingoServiceError if the Modal endpoint returns a non-OK status.
 */
export async function callFlamingoGenerateBatch(
  params: FlamingoBatchRequest,
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
      prompts: params.prompts.map(
        ({ id, prompt, max_new_tokens, clip, temperature, top_p, do_sample }) => ({
          id,
          prompt,
          max_new_tokens,
          ...(clip ? { clip_start: clip.start, clip_end: clip.end } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
          ...(top_p !== undefined ? { top_p } : {}),
          ...(do_sample !== undefined ? { do_sample } : {}),
        }),
      ),
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
