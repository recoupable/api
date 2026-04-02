import { ELEVENLABS_BASE_URL } from "@/lib/const";

/**
 * Calls an ElevenLabs Music API multipart/form-data endpoint.
 * Used by video-to-music and stem-separation which accept file uploads.
 *
 * @param path - The API path (e.g. "/v1/music/video-to-music").
 * @param formData - The FormData containing files and fields.
 * @param outputFormat - Optional audio output format query param.
 * @returns The raw Response from ElevenLabs.
 * @throws Error if ELEVENLABS_API_KEY is not configured.
 */
export async function callElevenLabsMusicMultipart(
  path: string,
  formData: FormData,
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
      "xi-api-key": apiKey,
    },
    body: formData,
  });
}
