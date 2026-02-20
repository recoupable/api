import { FLAMINGO_GENERATE_URL } from "@/lib/const";
import type { FlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";

/**
 * Response shape from the Music Flamingo /generate endpoint on Modal.
 */
export interface FlamingoGenerateResult {
  /** The model's text response about the music */
  response: string;
  /** Inference time in seconds */
  elapsed_seconds: number;
}

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

  const data = (await response.json()) as FlamingoGenerateResult;
  return data;
}
