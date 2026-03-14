import { type GenerateVideoResponse } from "./generateVideo";

/**
 * Retrieves a video generation job status and details from OpenAI's API
 *
 * @param videoId - The video ID to retrieve
 * @returns The video generation response
 */
export async function retrieveVideo(videoId: string): Promise<GenerateVideoResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API request failed with status ${response.status}`,
    );
  }

  const data: GenerateVideoResponse = await response.json();
  return data;
}
