import { FLAMINGO_GENERATE_URL } from "@/lib/const";
import type { FlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";
import {
  isFlamingoGenerateResult,
  type FlamingoGenerateResult,
} from "@/lib/flamingo/isFlamingoGenerateResult";
export type { FlamingoGenerateResult };

/**
 * Calls the Music Flamingo /generate endpoint on Modal.
 * This is the shared business logic used by both the API route handler
 * and the MCP tool (DRY pattern).
 *
 * @param params - Validated request parameters matching the FlamingoGenerateBody schema.
 * @returns The model's response text and inference time.
 * @throws Error if the Modal endpoint returns a non-OK status.
 */
export async function callFlamingoGenerate(
  params: FlamingoGenerateBody,
): Promise<FlamingoGenerateResult> {
  const response = await fetch(FLAMINGO_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      audio_url: params.audio_url ?? null,
      max_new_tokens: params.max_new_tokens ?? 512,
      temperature: params.temperature ?? 1.0,
      top_p: params.top_p ?? 1.0,
      do_sample: params.do_sample ?? false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Flamingo model returned ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json();
  if (!isFlamingoGenerateResult(data)) {
    throw new Error("Flamingo model returned an unexpected response shape");
  }
  return data;
}
