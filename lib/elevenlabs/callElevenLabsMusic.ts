import { ELEVENLABS_BASE_URL } from "@/lib/const";

/**
 * Calls an ElevenLabs Music API JSON endpoint.
 * Shared by all music handlers that send JSON bodies.
 *
 * @param path - The API path (e.g. "/v1/music" or "/v1/music/plan").
 * @param body - The JSON request body.
 * @param outputFormat - Optional audio output format query param.
 * @returns The raw Response from ElevenLabs.
 * @throws Error if ELEVENLABS_API_KEY is not configured.
 */
export async function callElevenLabsMusic(
  path: string,
  body: Record<string, unknown>,
  outputFormat?: string,
): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const url = new URL(path, ELEVENLABS_BASE_URL);
  if (outputFormat) {
    url.searchParams.set("output_format", outputFormat);
  }

  return fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}
